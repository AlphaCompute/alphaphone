# Eliza — Design Exploration Plan

## Working draft · Tablet experience

## **Purpose**

Create visual explorations that make Eliza’s future vision tangible, support partnership conversations, and establish reusable components that can later inform the product build.

The central promise is that someone like Margaret can complete everyday digital tasks on her own device, understand what is happening, stay in control, and verify the outcome afterward.

This plan draws from the [Eliza Product Vision](https://docs.google.com/document/d/1l6O9s8P5jtzoisotUgyMbcRP-btrN0LbgMLxHV1PBd4/edit).

## **1\. Product principles**

| Principle | Implication for design |
| :---- | :---- |
| Speak to Eliza; type, or let Eliza fill, the website. | Voice is for talking to Eliza: questions, "wait," "yes," "what does this mean?" Nothing is dictated into a website's fields. A field is filled either by Eliza, from something Margaret has already connected or saved (her email address, a sign-in code, the password manager), or by Margaret typing. When Eliza can fill a field, it offers the value at the field ("Use margaret.h@example.com?" with Yes / No, I'll type), and she can answer by tapping or saying "yes." The mic is off until she taps Talk. Eliza also opens it by itself right after asking her a question. While she's in a spoken exchange, every Eliza turn that needs something from her ends in a question and keeps listening. Type is always beside Talk. |
| Keep the current task visible, at three levels. | The side panel shows the workflow ("Paying your electricity bill") and the current step ("Signing in to Northfield"). The instruction for the field she's working on ("Type your email.") is attached to that field on the website, not in the panel. Her questions and Eliza's answers appear in the panel under the step and stay there for the whole workflow. They clear when the workflow ends and are kept with the receipt. With the keyboard open, the step title hides and only the workflow line stays. |
| Make Eliza easy to find while keeping the task usable. | Provide a recognizable, predictable presence. Expand as needed while keeping relevant website content visible, including when the keyboard is open or text is enlarged. |
| Present one clear next step. | Show only the current step and the one thing to do now. Don't preview upcoming steps or show a step list or progress tracker. Keep the instruction short (5–6 words) and put it next to the thing it refers to, so Margaret doesn't have to look back and forth. |
| Make control and responsibility visible. | While Eliza acts, the Eliza surface turns blue (the whole side panel, or the dock band in full screen) with one sentence and Pause. When it's her turn, the surface is white. The dock always says whose turn it is: Listening…, Eliza is replying…, Paused, or Eliza is working…. Clearly separate preparation, submission and confirmation. |
| Adapt to the person and preserve their place. | Support comfortable text size, speaking pace, volume and generous touch targets. Use respectful adult language and retain the current step through interruptions. |
| Give the screen to what the person is working on. | When the task is on a website or document, Eliza sits in the side panel and shows only the current step. When the conversation itself is the task (a question, deciding what to do next), Eliza takes the full screen, and the conversation with its captions is the content. Eliza moves between the two by herself and says what she's doing ("I'll open Northfield's website and move to the side so you can see it"). The person never has to minimize, resize or switch windows. Questions asked during a task are answered in the side panel and don't take over the screen. If the person leaves the task, Eliza shows it as paused with a clear way to resume. Talk, Pause and Close stay in the same order and look the same in both modes. |
| Ask before acting. | Eliza asks for a clear yes before it opens a website, moves to a new page, looks something up or fills in a field. Margaret presses every submit, sign-in and payment button herself. Answers to Eliza's questions carry equal weight, so "Not now" feels as safe to tap as "Yes". |
| Explain rather than disable. | No button is ever dimmed. If an action doesn't apply, it isn't shown. If something is needed first, tapping it explains what's missing ("Type your message first."). |

Voice reducing effort or improving speed is a hypothesis to test with our users. Success includes task completion, understanding, confidence and ease of recovery.

### **Visual and brand direction**

A calm, functional tablet interface inspired by Apple’s clarity, hierarchy and consistency. Use a restrained palette; color should support recognition, action and state rather than decoration. Eliza’s personality should come through in patient language, predictable behavior and a recognizable presence.

Readability comes first. Use clear typography, comfortable text sizes, strong contrast and generous spacing. Avoid thin lettering, faint instructional text and dense paragraphs. Enlarged text must wrap without hiding essential controls.

Give Eliza a dependable visual surface. Start with an opaque assistance surface so readability does not depend on the website underneath. Test any transparency before adopting it.

Make Eliza unmistakably identifiable. Use a consistent identity mark, container shape, labels and control placement. Recognition must hold even when a website uses similar colors.

Use color deliberately and sparingly. Use neutral surfaces and high-contrast text. The whole panel is blue while Eliza acts and white during Margaret’s turn; this is functional state color. Pair these states with the action sentence/Pause or listening feedback. Warnings and outcomes also combine color with labels, icons or shapes.

Make actions visibly actionable. Use clearly bounded, explicitly labeled buttons with generous touch areas and separation. Keep secondary choices findable; avoid gesture-only or tiny icon-only essential controls.

Direct attention precisely. Highlight one relevant target without obscuring its contents. Explore an outline with a contrasting outer edge or backing that remains visible across page colors.

Keep the task readable around Eliza. Keep the active field, website controls and keyboard usable. Preserve predictable placement and avoid unnecessary movement of the assistance surface.

Use motion to explain changes. Use restrained motion to locate a target or communicate an action or state change. Support reduced motion and keep important instructions available.

Status is never colour alone. Success has a check, warnings a triangle, and blue states a sentence. Text is at least 4.5 : 1, and shapes that carry meaning at least 3 : 1\.

Keyboard focus and Eliza's guidance must never look alike. Focus is a 3dp ink ring with a white gap. Eliza's guidance ring is blue, 4dp, and always comes with a label.

### **Adaptation for older users**

Keep the experience adult, capable and contemporary. Make cues more explicit and defaults more forgiving: labeled controls, dependable boundaries, comfortable sizing, persistent guidance and clear explanations at uncertain moments. Test with people who have different visual, hearing, motor and digital-confidence needs; age does not define one uniform profile.

Apple is a directional reference, not a substitute for testing Eliza’s accessibility. [Apple interface design guidance](https://developer.apple.com/design/tips/) and [Apple color guidance](https://developer.apple.com/design/human-interface-guidelines/color) inform this direction.

### **Do’s and don’ts for design reviews**

| Principle | Do | Don’t |
| :---- | :---- | :---- |
| Speak to Eliza, not to fields | Offer Talk and Type. Open the mic after Margaret taps Talk or Eliza asks a question. Offer values Eliza already has, right at the field. | Dictate emails, passwords or codes into fields, or make her work out whether Eliza will treat her words as a question or as text for the box. |
| Keep the current step visible | Attach a short instruction to the highlighted field. Keep the workflow and step at the top of the panel. | Put the instruction in the panel, away from the field, or show upcoming steps. |
| Prioritize readability | Use readable text on a high-contrast surface. Let larger text wrap and the panel grow. | Shrink text to preserve a compact layout, truncate instructions or fade essential information. |
| Separate Eliza from the website | Give the panel a dependable background, visible boundary and consistent identity. | Place text over a busy page or rely on transparency with unpredictable contrast. |
| Make actions explicit | Use labeled Pause and Yes / No, I'll type controls with generous spacing. | Hide important actions behind gestures, small icons or tightly packed controls. |
| Use color meaningfully | Pair warning color with an icon and a message such as “That code has expired.” | Use a red outline alone or give ordinary controls the same urgency as warnings. |
| Highlight one clear target | Outline the email field without covering its label or contents; connect the instruction clearly. | Highlight unrelated controls together or cover the field with a callout. |
| Show who is acting | Distinguish Margaret’s turn, Eliza acting and the website processing with clear status text. | Use the same unexplained animation for listening, acting and waiting. |
| Preserve control | Keep Pause findable, stop advancing when interrupted and offer a clear way to resume. | Continue clicking while Margaret asks a question or restart the task after a pause. |
| Keep the task usable | Reposition guidance when the keyboard opens while keeping the active field visible. | Cover the field, sign-in button or control needed to dismiss the keyboard. |
| Explain consequential actions | Before payment, show amount and method and state that nothing has been paid yet. | Label final payment submission with an ambiguous “Continue.” |
| Make outcomes trustworthy | Show a waiting state, then the provider’s confirmed result and saved receipt. | Claim success immediately after a tap or dismiss the result automatically. |
| Respect the person | Explain plainly that the website needs a sign-in code and offer help finding it. | Say “This is easy,” “Just click there,” or use childish praise for routine actions. |
| Use motion with a purpose | Use brief pointer movement or tap feedback to explain actions, with reduced-motion support. | Add continuous bouncing, flashing or decorative movement. |
| One step at a time | Show only what's needed now. | Show step lists, progress trackers or "coming next" hints. |
| Plan for the keyboard | Open the full-width keyboard whenever a text field is selected, including while Eliza offers a value. Shorten the panel to sit above it and keep the dock visible. | Let the keyboard cover the dock, the active field or the button she needs next. |
| Ask before acting | "Shall I fill in the amount and date? Nothing is paid yet." | Open a page, fill a field or check something without her yes. |
| Explain, don't disable | Keep Send enabled and say "Type your message first." | Dim a button so she taps it, gets no response and thinks the tablet is broken. |
| Guidance floats on top | Draw the ring and label in their own layer above the website. | Change, restyle or push down the company's page. |

Review question: Can Margaret identify who is helping, what to do next, where to do it, and how to stop—without guessing?

## **2\. The five flows we ultimately want to showcase**

| Flow | Key moments | Steps |
| :---- | :---- | :---- |
| Meet Eliza | Greeting → name → language → speaking pace → text size → what Eliza does → try Close and the tab | S01–S07 |
| Find the bill | How it arrives → which email service → connect Gmail → Google sign-in → save password → Anna, later → check permissions → bill found → readable bill | S08–S19 |
| Sign in | Pointer introduced → Eliza opens the site → email offer → password → her Sign in tap → code offer → Verify | S20–S27 |
| Check before paying | Address → amount → already paid? → pay from → amount and date → automatic payments → review | S28–S34 |
| Finish | Waiting → confirmed → receipt → shortcuts → home → later: wake and recall | S35–S40 |

## **3\. Design approach**

Start with individual components, evaluated within a realistic tablet screen.

Use a single example website and workflow as a consistent backdrop. Curate Eliza’s presence, highlighting, instructions and controls individually, then combine them into a short interaction. Test the resulting patterns on other layouts before establishing them in the design system.

Our first example is Margaret signing into her electricity account. This gives each component a concrete purpose without requiring the whole bill-payment experience to be designed at once.

**Two kinds of connection.** *Connectors* (e.g. Gmail) sign in on the provider's own pages, which open in the browser with Eliza in the side panel. Eliza labels and explains but never sees or types the password, and it flags any permission broader than the task needs. *Assisted websites* (e.g. Edison) have no connector, so Eliza guides Margaret through the real site in the side panel.

### **Wireframing first, then visual direction**

Rounds 1–5 focus on component and interaction wireframes. Establish hierarchy, readable sizing, surface opacity, button prominence, target highlighting and placement now; these affect usability. Use neutral styling with only the color needed to evaluate functional states. Keep the final logo, palette, typeface and decorative styling open.

After the core interaction and reuse checks, apply two or three visual directions to the same screens. Curate the brand expression separately from the interaction, then polish representative screens for partnership conversations and extend the chosen direction to the broader narrative.

## **4\. First exploration: screens and interaction states**

States 1–8 are complete; see the Flow map, S20–S27.

Several of these states occur on the same webpage.

| Screen / state | Experience to explore |
| :---- | :---- |
| 1\. Help is available | A "Talk to Eliza" tab on the right edge opens the docked 400px panel beside the website. The entry point stays clear of website chat assistants, cookie banners and the home gesture, and stays put when the keyboard opens. |
| 2\. Ask for help | Margaret taps Talk or Type; Eliza shows the current dock state and acknowledges the task. Eliza also opens the mic immediately after asking her a question. |
| 3\. Enter the email address | Eliza selects the field, and the keyboard opens. If Eliza already knows her email from the Gmail connection, it offers it at the field; Yes (tapped or spoken) lets Eliza enter it. Otherwise Margaret types it. The instruction sits at the field. |
| 4\. Pause or ask a question | Eliza stops advancing, explains the current step and lets Margaret resume without losing her place. |
| 5\. Enter the password | Margaret types it, or the password manager fills it after she approves. Passwords are never spoken or shown in the conversation. |
| 6\. Submit and wait | Margaret selects the website’s sign-in button. Eliza communicates the waiting state and updates guidance when the page changes. |
| 7\. Complete verification | Eliza offers the matching email code at the verification field with its source and arrival time. Margaret accepts Yes by tapping or speaking, or chooses No, I'll type. Nothing is dictated into the field. |
| 8\. Confirm access | The account opens. Eliza confirms successful sign-in and offers to continue with the bill. |

Device assumption: an Android tablet in landscape, running Eliza's own Android-based OS, at 1194 × 834dp. The standard full-width keyboard opens whenever a text field is selected. The side panel shortens to 534dp to sit above it, and the step title hides. The keyboard has no voice-typing button; voice is for talking to Eliza.

States 1–8 are complete. The verification example assumes Gmail is already connected, matching this point in the vision narrative.

## **5\. Atomic design components**

| Component | What it covers |
| :---- | :---- |
| Foundations | Colour roles, type scale (26 full screen / 24 panel), 8dp grid, targets (80 main, 64 compact, 56 utility), motion, icons, accessibility rules |
| Button | Primary, secondary, on-blue; default, pressed and focus states; no disabled state; equal-width pairs |
| Header | Mark, name, Close (grey utility); white and blue |
| Dock | Turn, Listening, Busy (Eliza is replying…), Typing (grows to 3 lines), Paused, Working, Done, Speaking |
| Conversation | Eliza message, Margaret bubble, live transcript, thinking dots, system line, cards (bill, receipt, warning), item row, Answers |
| Website guidance | Outline ring, Guide label (text, subtext, tone, busy, answers, placement), pointer with name tag |
| Side panel / Full screen | Compositions of the above: 400 beside a website, or the 880 column |
| System surfaces | Wake screen, home screen, Eliza tab (default, hint, Task paused band), shortcuts, recall |
| Accounts | Service confirmation card, permission list, offers at a field, password-manager sheet |
| Onboarding | Name, language, speaking-pace scale, live text-size preview |

Shared foundations include typography, color, contrast, spacing, touch areas, corner treatments and motion timing.

## **6\. How the components combine**

| Composed component | Building blocks |
| :---- | :---- |
| Collapsed Eliza entry point | Identity mark \+ labeled button |
| Expanded assistance surface | Docked 400dp panel beside the website, shortening to 534dp above the full-width keyboard. The workflow stays visible; the step title hides with the keyboard open. Conversation reads top to bottom: Margaret’s questions are grey bubbles, Eliza’s replies are plain text with no name label. The dock stays visible and shows the current turn and action. In full screen, content uses an 880dp column; the blue acting state applies to the dock band. |
| Guidance callout | Field instruction label \+ target anchor \+ field offer when an approved saved or connected value is available. |
| On-screen guidance | Target outline \+ callout; pointer and tap indicator when Eliza acts |
| Pause and resume controls | One dock, one clear thing to tap. Pause while Eliza acts, Stop listening while the mic is open, Continue when paused. Talk and Type on her turn. Eliza never carries on by itself. |
| Verification suggestion | Field offer \+ source and arrival time \+ Yes / No, I'll type \+ retrieval/applied status. Acceptance can be tapped or spoken. |
| Completion message | Result indicator \+ explanation \+ next-step choice |

Explore behavior alongside appearance: who is acting, when guidance advances, how it responds to scrolling, where it sits around the keyboard, and what happens when the expected result does not arrive.

The website owns its existing fields and buttons. Eliza’s assistance surrounds those controls; any replacement or additional control needs an explicit product decision.

## **7\. Exploration sequence and review points**

| Round | Design work | Curation decision |
| :---- | :---- | :---- |
| 1\. Presence | Use the selected right-edge entry tab and docked 400px panel; verify keyboard behavior and blue acting/white listening states. | Does the chosen presence remain recognizable and usable with the keyboard open? |
| 2\. Guidance | Explore highlighting, instructions, pointer feedback and pause controls | Is the next step obvious, and can Margaret distinguish guidance from action? |
| 3\. First interaction | Connect asking for help, entering an email and pausing | Does the experience feel coherent and comfortably paced? |
| 4\. Full sign-in | Add password entry, waiting, verification and success | Are sensitive input, transitions and outcomes understandable? |
| 5\. Reuse | Apply the selected components to another website layout and larger text; explore the deferred adaptive slim panel here. | Which patterns generalize, and which need variants? |
| 6\. Broader story | Extend into payment review and receipt retrieval, then onboarding and account connection | Does the experience communicate Eliza’s value across the full narrative? |

### **Status — Sep 28, 2026**

* Rounds 1–4 and the wireframe pass of Round 6 are done. A clickable prototype covers the full bill payment. Twelve component sheets have Android build specs, and a 40-step flow map is the prototype blueprint.  
* Remaining: Round 5 — reuse and accessibility: another site layout, dark websites and text beyond step 5, plus sessions with representative users.  
* Remaining: the visual-direction round — the brand pass is paused at directions 4a–4c.

### **Visual-direction review before the broader story**

After round 5, compare two or three visual directions on the same wireframes. Test on light, dark, busy and similarly colored websites, with the keyboard open and text enlarged. Choose the direction before polishing partnership screens and extending round 6\.

Three focused comparisons: a translucent versus opaque assistance panel; an icon-only cue versus a field highlight with a short labeled instruction; and an unexplained spinner versus a persistent, explanatory waiting state. Use the principles and do’s and don’ts above to assess each treatment.

At each round, record what to keep, what to change and why. Keep the design system provisional while patterns are still being tested.

### **Round 1 decisions**

Decision date: Sep 25, 2026

* Entry point: a "Talk to Eliza" tab on the right edge. It stays clear of websites' own chat assistants and cookie banners, doesn't conflict with the home gesture, and stays put when the keyboard opens.  
* Expanded form: a docked panel, 400px wide, with the website beside it. An adaptive slim panel is deferred to Round 5\.  
* Panel content: workflow and step at the top, instruction at the field, questions and answers in the panel. Rejected: the chat-log-only panel, step lists and preset question buttons.  
* Eliza's turn: blue panel with one sentence and Pause.  
* Her turn: white panel. Listening behavior was superseded; see Decisions since Round 1 below. Fields are filled by Eliza’s offer or by typing, never by dictation.  
* Keyboard: Replaced Sep 28, 2026: the full-width keyboard; the panel shortens to 534\.  
* Listening: Replaced Sep 27, 2026: off until invited (see the Decisions since Round 1 list below).  
* Conversation: reads top to bottom, persists for the workflow, clears at the end and is kept with the receipt. Only her questions are bubbles.

### **Decisions since Round 1 (Sep 27, 2026–Sep 28, 2026\)**

* Listening: off until she taps Talk. Eliza opens the mic after asking a question. One "Listening…" state, with Stop listening as the way out.  
* Talk and Type: equal width. Typing shows a text box with Send and Talk. Talk closes the keyboard and keeps the draft.  
* Consent: a clear yes before any open, move, look-up or fill. She presses every submit button herself.  
* Email: Eliza never guesses the email service. It asks how the bill arrives, then which service she uses, then asks to connect. Sign-in happens on Google's own pages. No email is needed at tablet setup.  
* Buttons: no disabled states.  
* Guidance: labels float on top of the website, outlined in blue.  
* Type: senior scale; the full-screen column is 880 wide.  
* Close: hides Eliza and pauses any task. The tab shows a yellow "Task paused" band, and reopening asks "Shall I carry on?"  
* Onboarding: one Eliza voice; language, pace and text size are chosen by saying so.

### **Detailed process for creating and curating designs**

#### **Working rhythm**

Each round produces a small, reviewable set of designs. The designer or design agent prepares the options and a recommendation; Camilla curates the direction. We revise the selected option before carrying it into dependent work. Decisions remain provisional where user testing is still needed.

#### **Prepare the shared example**

Create a reference board containing the agreed principles, do’s and don’ts, selected Apple references and one realistic electricity sign-in page on an Android tablet in landscape. Use fictional account details. Fix page content and starting layout so component treatments can be compared fairly. Use the selected 400dp docked panel and standard full-width keyboard; the panel shortens to 534dp above it and hides the step title.

#### **Round 1 — Establish Eliza’s presence**

Round 1 direction is selected: a right-edge Talk to Eliza tab and a docked 400dp panel beside the website. Show keyboard-open and keyboard-closed states using the current decisions below: the panel shortens above the full-width keyboard, and the step title hides. The blue acting state shows one sentence and Pause; Margaret’s white surface uses Talk and Type, with the mic off until invited. Do not reopen rejected chat-log-only panels, step lists or preset question buttons without new evidence.

Camilla reviews: Does the selected entry tab and docked panel remain recognizable and usable around website assistants, cookie banners and the keyboard? Resolve any overlap with the active field or controls; preserve the Round 1 decisions while refining details.

#### **Round 2 — Build the guidance components**

Using the selected presence, explore field instruction labels and field offers first, then the target outline, action pointer, tap feedback, status labels and pause/resume controls. Keep labels at the field, short (5–6 words), above or below it without covering its label or content. Test flipping and keyboard constraints. Change one component family at a time while holding the page and wording constant; show each component alone and in context.

Camilla reviews: Which treatment makes the next step clearest? Does it distinguish Margaret’s turn from Eliza acting? Select a coherent combination; record the chosen states and reasons rather than mixing unrelated options without checking them together.

#### **Round 3 — Assemble the first interaction**

Connect screens 1–4: open Eliza, ask for help, identify the email field, enter the address, ask a question or pause, and resume. Add the intended spoken line and persistent visual instruction to each frame. Use a simple clickable or timed prototype to inspect transitions and pacing.

Camilla reviews: Is the sequence understandable without additional explanation from the designer? Can Margaret interrupt and resume at the correct step? Revise wording, placement and timing before adding the rest of sign-in.

Also show the move between modes: a full-screen conversation that becomes a task ("I need to pay my electricity bill") as Eliza opens the website and steps into the side panel, and the reverse when Margaret leaves the task, with the task shown as paused. Eliza makes and explains every switch; test whether Margaret still recognizes the panel as the same Eliza.

#### **Round 4 — Extend through verification**

Add screens 5–8 using the selected components: password entry, submission, waiting, code retrieval and confirmed access. Include sensitive-input treatment and at least one recovery branch, such as a code that cannot be retrieved or has expired. Distinguish the provider’s confirmed result from an action merely being attempted.

Camilla reviews: Are responsibility, privacy, waiting and recovery understandable? The output is a connected sign-in flow with its main states and one recovery path, ready for reuse checks.

#### **Round 5 — Test reuse and accessibility**

Apply the same components to another website layout before creating site-specific variants. Check light, dark, busy and similarly colored backgrounds; enlarged text; keyboard visibility; touch spacing; and reduced-motion behavior. Compare voice with a short visual instruction and with accessible captions. Check contrast and control sizing against the selected platform’s accessibility guidance.

With representative users, observe whether they can find Eliza, identify the next action, pause and recover without coaching. Record completion, effort, errors and confidence as well as speed. If user sessions have not happened, label findings as design-review hypotheses rather than validated results.

Camilla reviews: Which failures require a shared component change, and which require a placement variant? Update the shared pattern first where possible, then recheck affected screens. Keep unresolved usability issues visible.

#### **Visual-direction round — Apply the restrained brand**

After the wireframe reuse checks, apply two or three visual directions to the same representative screens without changing their structure or copy. Explore typography, neutral surfaces, functional accent color, borders, icon treatment and restrained motion within the agreed principles. Do not vary the workflow at the same time.

Camilla reviews: Which direction feels calm, capable and recognizable while making actions most obvious? Refine the preferred direction, then repeat the background, enlarged-text and keyboard checks before extending it.

#### **Round 6 — Build the broader narrative**

Carry the chosen system into payment review and receipt retrieval, then onboarding and account connection. Reuse existing components first and identify any genuinely new need. Curate a small set of polished screens and a connected demonstration for partnership conversations. Label simulated behavior and unresolved integrations clearly.

#### **Consolidate the design system and build handoff**

For each selected component, record its name, purpose, anatomy, variants, states, placement rules, voice/text behavior and accessibility requirements. Link it to the screens that use it. Record what information it needs, what changes its state, and whether Eliza, the operating system or the website owns the control. Promote patterns into the reusable library after they work in context; keep untested variants provisional.

#### **How each review is presented**

Present the decision being made, two or three comparable options when alternatives are useful, a recommended option with its tradeoff, and the relevant full-screen context. Camilla’s feedback identifies what to keep, what to change and why. Close the round with an updated chosen design, a brief decision note and any remaining question. Avoid reopening resolved decisions unless new evidence or a downstream failure warrants it.

#### **Immediate next deliverable**

Round 5 on the existing components: apply them to a second website layout and a dark site, test text sizes 4–5, and settle the open items in each sheet. Then resume the brand pass (directions 4a–4c) on the same screens, and run first sessions with representative users.

## **8\. Outputs and open questions**

The exploration should produce a curated visual direction, a connected sign-in prototype, a reusable component inventory with states and behaviors, and representative screens for partnership conversations.

For eventual implementation, record what each component needs to know, what triggers its state changes, and whether it belongs to Eliza, the operating system or the service provider.

Questions to resolve through exploration and user feedback:

* How long should the mic wait after Eliza asks a question, and what's the right pause-in-speech threshold for someone who speaks slowly?  
* Can she interrupt Eliza mid-reply?  
* "Close" or "Hide"? Is the grey Close findable enough?  
* Does the guidance ring stay visible on dark websites? What happens if the target scrolls off-screen?  
* What happens at text sizes beyond step 5, including labels that wrap to 3+ lines?  
* Should the "Hey Eliza" wake word be adopted?  
* Setting up Anna's access, the "on paper" bill, the "Something else" email service, and no connection are not designed yet.  
* Where should the field label go on crowded or unusual layouts, and when the keyboard is open?  
* How much typing is too much? Which values can Eliza fill for her, from connections she's already approved?  
* How do people recognize whose turn it is from the panel color and dock status?  
* Can they pause, correct and resume comfortably?  
* Do the patterns remain usable with larger text and different website layouts?

Older users have varied hearing, vision and motor needs, supporting adaptable presentation and alternatives to speech. [W3C guidance for older users](https://www.w3.org/WAI/older-users/developing/).

Clear steps and orientation after interruptions also inform this plan. [W3C guidance on clear steps](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/).