// The wording of every MUN reference sheet. Kept consistent with the blog:
// /blog/mun-clause-phrases (which verbs only the Security Council may use),
// /blog/mun-motions-explained (vote thresholds), /blog/mun-points-explained.
// No em dashes. Rules vary by conference, and the sheets say so.

const list = (s) => s.split('\n').map((t) => t.trim()).filter(Boolean).map((t) => {
  const m = t.match(/^(.*?)\s*(†)$/);
  return m ? { text: m[1], mark: m[2] } : { text: t };
});

export const SHEETS = [
  {
    name: 'preambulatory-phrases',
    title: 'Preambulatory Phrases',
    lead: 'They open each preambulatory clause of a resolution: the reasons and background. Write the phrase in italics and end the clause with a comma.',
    kind: 'columns',
    columns: 4,
    items: list(`
      Acknowledging
      Affirming
      Alarmed by
      Appreciating
      Approving
      Aware of
      Bearing in mind
      Believing
      Cognizant of
      Concerned by
      Confident
      Conscious of
      Contemplating
      Convinced
      Declaring
      Deeply concerned
      Deeply conscious
      Deeply convinced
      Deeply disturbed
      Deeply regretting
      Deploring
      Desiring
      Determined
      Emphasizing
      Encouraged by
      Expecting
      Expressing its appreciation
      Expressing its satisfaction
      Fulfilling
      Fully alarmed
      Fully aware
      Fully believing
      Further deploring
      Further recalling
      Gravely concerned
      Guided by
      Having adopted
      Having considered
      Having examined
      Having heard
      Having received
      Having studied
      Keeping in mind
      Mindful of
      Noting
      Noting further
      Noting with approval
      Noting with deep concern
      Noting with regret
      Noting with satisfaction
      Observing
      Reaffirming
      Realizing
      Recalling
      Recognizing
      Referring
      Reiterating
      Seeking
      Stressing
      Taking into account
      Taking into consideration
      Taking note
      Underlining
      Viewing with appreciation
      Welcoming
    `),
    note: 'Example: <i>Deeply concerned</i> by the rise in displacement caused by drought in the Sahel,',
  },
  {
    name: 'operative-phrases',
    title: 'Operative Phrases',
    lead: 'They open each operative clause: what the committee actually does. Number every clause, underline the phrase and end with a semicolon (the last one with a full stop).',
    kind: 'columns',
    columns: 4,
    items: list(`
      Accepts
      Affirms
      Approves
      Asks
      Authorizes
      Calls for
      Calls upon
      Condemns
      Confirms
      Congratulates
      Considers
      Decides †
      Declares accordingly
      Demands †
      Deplores
      Designates
      Draws the attention of
      Emphasizes
      Encourages
      Endorses
      Expresses its appreciation
      Expresses its hope
      Further invites
      Further proclaims
      Further recommends
      Further reminds
      Further requests
      Further resolves
      Has resolved
      Invites
      Notes
      Proclaims
      Reaffirms
      Recommends
      Regrets
      Reminds
      Requests
      Resolves
      Solemnly affirms
      Strongly condemns
      Strongly urges
      Suggests
      Supports
      Takes note of
      Transmits
      Trusts
      Urges
    `),
    note: '<b>†</b> Security Council only. The General Assembly recommends; only the Council can bind States (UN Charter, Article 25).',
  },
  {
    name: 'motions',
    title: 'Motions in Model UN',
    lead: 'Raise a motion when the chair opens the floor. If several are raised, the chair usually votes on the most disruptive first.',
    kind: 'table',
    head: ['Motion', 'What it does', 'Vote needed', 'Say'],
    rows: [
      ['Open the Speakers List', 'Starts the General Speakers List (GSL)', 'Simple majority', '"Motion to open the speakers list"'],
      ['Set the Speaking Time', 'Changes how long each GSL speech lasts', 'Simple majority', '"...set the speaking time to 60 seconds"'],
      ['Moderated Caucus', 'Timed debate on one subtopic, the chair picks speakers', 'Simple majority', '"...10 minutes, 1 minute per speaker, on funding"'],
      ['Unmoderated Caucus', 'Free time to negotiate and write papers', 'Simple majority', '"...unmoderated caucus of 15 minutes"'],
      ['Extend the Caucus', 'Adds time to the caucus that just ended', 'Simple majority', '"...extend the caucus by 5 minutes"'],
      ['Introduce a Draft Resolution', 'Brings a draft with enough signatories to the floor', 'Simple majority', '"...introduce Draft Resolution 1.1"'],
      ['Move into Voting Procedure', 'Ends debate and votes on the drafts', 'Simple majority', '"...move into voting procedure"'],
      ['Table the Topic', 'Sets the topic aside without a resolution', 'Two-thirds', '"...table the topic"'],
      ['Suspend the Meeting', 'Pauses for a break or lunch', 'Simple majority', '"...suspend the meeting until 2 pm"'],
      ['Adjourn the Meeting', 'Ends the session for the day or for good', 'Simple majority', '"...adjourn the meeting"'],
    ],
    note: 'Rules of procedure differ between conferences. Check your conference\'s rules for the exact thresholds and order.',
  },
  {
    name: 'points',
    title: 'Points in Model UN',
    lead: 'A point is a question or request to the chair. Most are raised by placard and answered at once.',
    kind: 'table',
    head: ['Point', 'Use it when', 'Interrupts a speaker?'],
    rows: [
      ['Point of Personal Privilege', 'Something stops you taking part: you cannot hear, the room is too cold', 'Yes, if you cannot hear'],
      ['Point of Order', 'The chair or a delegate did not follow the rules of procedure', 'No'],
      ['Point of Parliamentary Inquiry', 'You have a question about the rules or what happens next', 'No'],
      ['Point of Information', 'You want to ask the last speaker a question, if they open to points', 'No'],
      ['Right of Reply', 'A speaker insulted your country\'s integrity, not just its policy', 'No, asked in writing or after the speech'],
    ],
    note: 'Not every conference allows every point. When in doubt, raise a Point of Parliamentary Inquiry.',
  },
  {
    name: 'committee-session-flow',
    title: 'How a Committee Session Runs',
    lead: 'The usual order of a Model UN committee, from the first gavel to the vote.',
    kind: 'flow',
    flowColumns: 2,
    steps: [
      { title: 'Roll call', text: 'Each delegation answers Present, or Present and Voting.' },
      { title: 'Open the Speakers List', text: 'Delegations sign up for the General Speakers List.' },
      { title: 'GSL speeches', text: 'Each delegation states its position in turn.' },
      { title: 'Caucuses', text: 'Moderated caucuses on subtopics, unmoderated caucuses to negotiate.' },
      { title: 'Working papers', text: 'Blocs write their ideas down and share them.' },
      { title: 'Draft resolutions', text: 'Papers with enough sponsors and signatories are introduced.' },
      { title: 'Amendments', text: 'Friendly ones are added; unfriendly ones are voted on.' },
      { title: 'Voting procedure', text: 'Debate closes and the committee votes on each draft.' },
      { title: 'Adjourn', text: 'The session ends; awards come at the closing ceremony.' },
    ],
  },
  {
    name: 'roll-call-and-voting',
    title: 'Roll Call and Voting',
    lead: 'What each answer means, at roll call and when the committee votes.',
    kind: 'table',
    head: ['Term', 'What it means'],
    rows: [
      ['Present', 'Your delegation is here and may abstain on substantive votes'],
      ['Present and Voting', 'Your delegation is here and must vote For or Against, never abstain'],
      ['Procedural vote', 'A vote on a motion. Everyone votes, no abstentions'],
      ['Substantive vote', 'A vote on a draft resolution or amendment. Abstaining is allowed if you said Present'],
      ['For / Against', 'Your vote on the draft'],
      ['Abstain', 'You take no side. Abstentions usually do not count toward the majority'],
      ['Pass', 'In a roll call vote, skip for now; you will be asked again at the end'],
      ['Rights', 'Vote with rights to explain your vote after the voting ends'],
      ['Veto', 'In the Security Council, one Against from a permanent member fails the draft'],
    ],
    note: 'Rules of procedure differ between conferences. Check your conference\'s rules for abstentions and roll call votes.',
  },
];
