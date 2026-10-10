#!/usr/bin/env python3
"""Host replica of the canonical synthesis-to-ASR round trip (release-05 root-cause evidence).

LocalSpeechInstrumentedTest synthesizes "The quick brown fox jumps over the lazy dog." with the
qualified Piper LJSpeech model through the no-eSpeak lexicon frontend, resamples the in-process
float buffer to 16 kHz with linear interpolation and asserts five keywords from Whisper tiny.en.

This script reproduces that path on a development host from the same qualified model bytes:
- the lexicon frontend exactly as sherpa-onnx 1.13.8 Lexicon::ConvertTextToTokenIdsNotChinese
  builds it (word phones, the " " token after each word, no punctuation tokens because the model
  declares none), then the no-eSpeak patch's AddBlank framing and Piper BOS=1 / EOS=2;
- the VITS model through ONNX Runtime, by default at both sherpa-onnx's default scales
  (noise_scale 0.667, length_scale 1.0, noise_scale_w 0.8; the pinned engine before patch 0066)
  and at zero noise (the engine with patch 0066-local-speech-deterministic-synthesis);
- Whisper tiny.en int8 through the sherpa-onnx Python recognizer with 2 threads;
- the canonical linear resampler, and the saved PCM16 path (round(x*32767), read back as /32768).

It runs a number of independent syntheses and reports, per noise setting, how often each ASR input
recognizes every keyword and whether the float and saved-PCM variants of the same synthesis agree.
The model graph holds two unseeded RandomNormalLike nodes, so each synthesis at nonzero noise is a
new waveform; the script also reports that directly.

This is host evidence only (macOS/Linux ONNX Runtime kernels), never an Android device result, and
it never replaces the unchanged canonical test or a functionalAcceptance record.

Requires host Python packages sherpa-onnx==1.13.8, onnxruntime, onnx and numpy in a disposable
virtual environment (never in the Android build). Usage:

  python3 scripts/local-speech/float-path-replica.py --models android/local-speech/src/main/assets/local-speech/v1 \
    --runs 200 [--noise 0.667:0.8 --noise 0:0] [--out result.json]
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys

WORDS = ('quick', 'brown', 'fox', 'lazy', 'dog')
SENTENCE = 'The quick brown fox jumps over the lazy dog.'
# SpeechText.prepare output for SENTENCE: lowercase lexicon words, '.' kept as its own token.
SPOKEN = 'the quick brown fox jumps over the lazy dog . '
DEFAULT_SCALES = (0.667, 0.8)  # sherpa-onnx OfflineTtsVitsModelConfig defaults (noise, noise_w)


def recognized(text):
    lower = text.lower()
    return all(word in lower for word in WORDS)


def read_tokens(path):
    tokens = {}
    for line in Path(path).read_text(encoding='utf-8').split('\n'):
        if not line:
            continue
        symbol, index = line.rsplit(' ', 1)
        tokens[symbol if symbol else ' '] = int(index)
    return tokens


def read_lexicon(path, tokens, needed):
    lexicon = {}
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            parts = line.split()
            if parts and parts[0] in needed and parts[0] not in lexicon:
                lexicon[parts[0]] = [tokens[phone] for phone in parts[1:]]
    return lexicon


def piper_ids(spoken, tokens, lexicon):
    blank = tokens[' ']
    ids = []
    for word in spoken.split():
        if word == '.':
            ids.append(blank)  # the model declares no punctuation; the sentence break adds a blank
            continue
        ids += lexicon[word]
        ids.append(blank)
    framed = [0] * (2 * len(ids) + 1)
    framed[1::2] = ids
    return [1] + framed + [2]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--models', required=True, help='local-speech/v1 directory with manifest.json')
    parser.add_argument('--runs', type=int, default=100)
    parser.add_argument('--noise', action='append', help='noise_scale:noise_scale_w (repeatable)')
    parser.add_argument('--out')
    args = parser.parse_args(argv)
    if args.runs < 1:
        parser.error('--runs must be positive')
    import numpy as np
    import onnxruntime as ort
    try:
        import onnx
    except ImportError:  # optional: only used to count the graph's random nodes
        onnx = None
    import sherpa_onnx

    models = Path(args.models)
    manifest = json.loads((models / 'manifest.json').read_text())
    for entry in manifest['files']:
        if entry['path'].startswith(('asr/', 'tts/')):
            digest = hashlib.sha256((models / entry['path']).read_bytes()).hexdigest()
            if digest != entry['sha256']:
                raise SystemExit('Model checksum mismatch: ' + entry['path'])
    random_nodes = seeded = None
    if onnx is not None:
        graph = onnx.load(str(models / 'tts/model.onnx'))
        random_nodes = [node for node in graph.graph.node if node.op_type.startswith('Random')]
        seeded = [node for node in random_nodes if any(attribute.name == 'seed' for attribute in node.attribute)]
        del graph

    tokens = read_tokens(models / 'tts/tokens.txt')
    lexicon = read_lexicon(models / 'tts/lexicon.txt', tokens, set(SPOKEN.split()))
    ids = piper_ids(SPOKEN, tokens, lexicon)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    tts = ort.InferenceSession(str(models / 'tts/model.onnx'), options, providers=['CPUExecutionProvider'])
    asr = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=str(models / 'asr/encoder.onnx'), decoder=str(models / 'asr/decoder.onnx'),
        tokens=str(models / 'asr/tokens.txt'), language='en', task='transcribe', num_threads=2)
    metadata = dict(tts.get_modelmeta().custom_metadata_map)
    rate = int(metadata.get('sample_rate', 22050))

    def transcribe(samples):
        stream = asr.create_stream()
        stream.accept_waveform(16000, np.asarray(samples, dtype=np.float32))
        asr.decode_stream(stream)
        return stream.result.text.strip()

    def linear16k(samples):  # LocalSpeechInstrumentedTest's resampler, in float64 like the Java double math
        count = len(samples) * 16000 // rate
        position = np.arange(count, dtype=np.float64) * rate / 16000
        left = np.minimum(position.astype(np.int64), len(samples) - 1)
        right = np.minimum(left + 1, len(samples) - 1)
        base = samples[left].astype(np.float64)
        return (base + (samples[right].astype(np.float64) - base) * (position - left)).astype(np.float32)

    def saved_pcm(samples):  # LocalSpeechEngine.Audio.wav() read back by readMono16kWav
        return (np.round(np.clip(samples, -1, 1) * 32767).astype(np.int16) / 32768.0).astype(np.float32)

    def synthesize(noise, noise_w):
        audio = tts.run(None, {'input': np.array([ids], dtype=np.int64),
                               'input_lengths': np.array([len(ids)], dtype=np.int64),
                               'scales': np.array([noise, 1.0, noise_w], dtype=np.float32)})[0]
        return audio.reshape(-1).astype(np.float32)

    settings = [tuple(float(value) for value in item.split(':')) for item in (args.noise or [])] or [DEFAULT_SCALES, (0.0, 0.0)]
    results = []
    for noise, noise_w in settings:
        passes = {'float': 0, 'savedPcm': 0}
        agree, peak, clipped, transcripts, disagreements = 0, 0.0, 0, {}, []
        first = synthesize(noise, noise_w)
        repeat_identical = bool(np.array_equal(first, synthesize(noise, noise_w)))
        for run in range(args.runs):
            samples = first if run == 0 else synthesize(noise, noise_w)
            peak = max(peak, float(np.abs(samples).max()))
            clipped += int((np.abs(samples) >= 1).sum())
            float_text = transcribe(linear16k(samples))
            pcm_text = transcribe(linear16k(saved_pcm(samples)))
            passes['float'] += recognized(float_text)
            passes['savedPcm'] += recognized(pcm_text)
            agree += recognized(float_text) == recognized(pcm_text)
            transcripts[float_text] = transcripts.get(float_text, 0) + 1
            if recognized(float_text) != recognized(pcm_text) and len(disagreements) < 10:
                disagreements.append({'run': run, 'float': float_text, 'savedPcm': pcm_text})
        results.append({'noiseScale': noise, 'noiseScaleW': noise_w, 'runs': args.runs,
                        'repeatSynthesisIdentical': repeat_identical, 'peak': peak, 'clippedSamples': clipped,
                        'floatPasses': passes['float'], 'savedPcmPasses': passes['savedPcm'],
                        'floatAndSavedPcmAgree': agree, 'floatTranscripts': transcripts,
                        'disagreementExamples': disagreements})
    report = {'execution': 'host-replica', 'host': sys.platform, 'onnxruntime': ort.__version__,
              'sherpaOnnx': getattr(sherpa_onnx, '__version__', 'unknown'), 'input': SENTENCE, 'spoken': SPOKEN,
              'tokenCount': len(ids), 'sampleRate': rate, 'modelMetadata': {key: metadata[key] for key in sorted(metadata) if key in ('add_blank', 'model_type', 'punctuation', 'language', 'comment')},
              'randomNodes': None if random_nodes is None else len(random_nodes),
              'seededRandomNodes': None if seeded is None else len(seeded), 'results': results,
              'limit': 'Host ONNX Runtime kernels; not Android device execution or functional acceptance'}
    text = json.dumps(report, indent=1)
    if args.out:
        Path(args.out).write_text(text + '\n')
    print(text)


if __name__ == '__main__':
    main()
