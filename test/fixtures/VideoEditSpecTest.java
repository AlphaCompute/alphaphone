package ai.elizaresearch.alphaphone;

/** Plain-JVM checks of the video copy range and geometry rules. Not Android, encoder or device evidence. */
public final class VideoEditSpecTest {
 static void check(boolean value,String label){if(!value)throw new AssertionError(label);}
 public static void main(String[] args){
  long duration=10_040;
  check(new VideoEditSpec(0,10.04,0,false,duration,1920,1080).unchanged(duration),"the exact full range is unchanged");
  check(new VideoEditSpec(0,10.0,0,false,duration,1920,1080).unchanged(duration),"an end 40 ms short of the duration is the full video, not a trim");
  check(new VideoEditSpec(0,10.09,0,false,duration,1920,1080).unchanged(duration),"an end within 0.05 s past the duration is the full video");
  VideoEditSpec trimmed=new VideoEditSpec(0,9.98,0,false,duration,1920,1080);
  check(!trimmed.unchanged(duration)&&trimmed.endMs==9_980,"an end 60 ms short is a real trim");
  check(new VideoEditSpec(1,10.0,0,false,duration,1920,1080).endMs==duration,"a snapped end keeps a trimmed start");
  check(!new VideoEditSpec(1,10.0,0,false,duration,1920,1080).unchanged(duration),"a trimmed start is still an edit");
  check(!new VideoEditSpec(0,10.0,90,false,duration,1920,1080).unchanged(duration),"a rotation is still an edit");
  boolean refused=false;try{new VideoEditSpec(0,10.1,0,false,duration,1920,1080);}catch(IllegalArgumentException expected){refused=true;}
  check(refused,"an end more than 0.05 s past the duration is refused");
  refused=false;try{new VideoEditSpec(9.95,10.0,0,false,duration,1920,1080);}catch(IllegalArgumentException expected){refused=true;}
  check(refused,"a snapped range still needs at least 0.1 s");
  VideoEditSpec rotated=new VideoEditSpec(0,5,90,false,duration,1920,1080);
  check(rotated.width==1080&&rotated.height==1920,"a quarter turn swaps the output size");
  System.out.println("PASS video edit spec");
 }
}
