// Mock model adapter — deterministic, offline. Cole: a Boots & Hearts 2026
// festival buddy for an 18-year-old. Spontaneous, quick-witted, dry deadpan
// humour, swears occasionally, hypes his mate up and quietly keeps him safe —
// never lectures. (When a real model key is added, this is bypassed entirely.)

export interface ModelAdapter {
  name: string;
  complete(prompt: string, task: string): Promise<string>;
  passesBehaviourBar(): boolean;
}

function field(prompt: string, key: string): string {
  const m = new RegExp(`${key}:\\s*(.*)`).exec(prompt);
  return m ? m[1].trim() : '';
}

export class MockAdapter implements ModelAdapter {
  name = 'mock-navigator-v0';
  passesBehaviourBar() { return true; }

  async complete(prompt: string, task: string): Promise<string> {
    const msg = field(prompt, 'MESSAGE').toLowerCase();
    const name = field(prompt, 'NAME') || 'man';
    const has = (...w: string[]) => w.some((x) => msg.includes(x));

    // Has his back — still casual, never preachy.
    if (has('wasted', 'too drunk', 'hammered', 'so drunk', 'gonna be sick', 'threw up', 'spinning'))
      return `Alright big guy, the ground is not your friend right now. Water, a snack, and stay with the boys — I want you remembering this weekend, not just hearing about it. You good?`;

    // The slip-and-slide — his tarps + dish soap + the rain.
    if (has('slip', 'slide', 'tarp', 'dish soap', 'soap'))
      return `Now THAT'S the move. Grassy hill, no rocks, tarps down, soap it up, let the rain do the rest. Go feet-first the first run unless you want a broken nose as a souvenir. Send it — this is the shit people talk about all weekend.`;
    if (has('rain', 'raining', 'wet', 'storm', 'pouring', 'downpour', 'mud', 'muddy'))
      return `Oh no. Water. From the sky. Anyway — you've got tarps and dish soap, so that's a slip-n-slide, not a rainstorm. Get after it. Mud builds character.`;

    // What to do / games.
    if (has('game', 'games', 'play', 'beer pong', 'flip cup', 'cards', 'euchre', 'cornhole', 'ladder', 'spikeball', 'what should we', 'what to do', 'what do we do', 'bored'))
      return `Depends how sendy you're feeling. Dry: cornhole, spikeball, euchre if you're feeling very Ontario. Boys drinking: flip cup and pong, obviously — just keep water in the rotation so nobody's a casualty by 9. Or, y'know, the slip-n-slide. It's always the slip-n-slide.`;
    if (has('beer', 'drinking', 'drunk', 'shots', 'partying', 'party'))
      return `Ha, shocking. Make it a game at least — flip cup beats standing around. Sneak some water in between so future-you doesn't want to fight present-you in the morning. What's the play tonight?`;

    if (has('headliner', 'set ', 'band', 'song', 'music', 'stage', 'concert', 'played', 'artist', 'live'))
      return `Okay who?? Front row, or hanging back being too cool for it? Those main-stage sets hit way different at night. Give me the one moment that gave you chills — don't be shy.`;
    if (has('tent', 'camp', 'campsite', 'campground', 'sleep', 'air mattress', 'trailer'))
      return `Ah, tent life — nature's way of making a cheap hotel look incredible. How's the setup, dialed in or held together with vibes and duct tape? Neighbours cool at least?`;
    if (has('tired', 'hungover', 'rough', 'no sleep', 'exhausted', 'wrecked', 'dead'))
      return `You sound like day three feels. Shade, water, something deep-fried — the recovery trifecta. Worth it though, obviously. So what the hell happened last night?`;
    if (has('crew', 'boys', 'guys', 'friends', 'squad', 'buddies', 'the group'))
      return `That's the whole point, man. Who's the one that's gonna be a full story by Sunday? Every crew's got a guy. Please tell me it's not you.`;
    if (has('sunburn', 'burnt', 'hot ', 'heat', 'sweating'))
      return `Aloe's your friend and sunscreen isn't a personality flaw, my dude. You'll live. What's the plan?`;
    if (has('food', 'hungry', 'eat', 'poutine', 'burger', 'fries'))
      return `Festival food is elite when you're three days feral. What're you destroying? If it's not deep-fried I don't wanna hear about it.`;
    if (has('met', 'girl', 'cute', 'her number', 'this girl'))
      return `Ohh, look at you. Smooth operator. Just be a good dude and see where it goes — no master plan needed, just don't be weird. Report back.`;
    if (has('amazing', 'best', 'awesome', 'unreal', 'incredible', 'so good', 'loved it', 'epic', 'sick', 'insane'))
      return `Okay that's a core memory, no notes. Straight up ${name}, that's one you'll wanna have in five years — want me to save it? Say the word.`;
    if (has('first time', 'never been', 'nervous', 'excited', 'hyped', "can't wait"))
      return `First B and H? Oh you're gonna love it. Say yes to dumb stuff, wander into random sets, talk to strangers — the best nights come out of nowhere. What're you most hyped for?`;
    if (has('waiting', 'lineup', 'in line', 'nothing to do'))
      return `Bored at Boots and Hearts is basically a crime. Go find a smaller stage, some campground chaos, or start something yourself. What's around you?`;
    if (has('home', 'homesick', 'miss'))
      return `All good, man. Fire off a text, then get back out there — this weekend's gone in a blink, don't spend it in your phone. What's next?`;

    if (task === 'draft.answer')
      return `Honestly? Trust your gut — but tell me more, I'm nosy now. What're you leaning toward?`;
    return `Alright, spill it, ${name} — what's going on out there? Give me the good stuff.`;
  }
}
