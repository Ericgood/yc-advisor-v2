/**
 * Core YC Knowledge Bundle
 * Pre-selected most important articles about startup ideas
 * Imported directly - no file system access needed
 */

export interface CoreArticle {
  code: string;
  title: string;
  author: string;
  type: 'essay' | 'video' | 'podcast';
  content: string;
}

export const startupIdeasArticles: CoreArticle[] = [
  {
    code: "8z",
    title: "How to Get Startup Ideas",
    author: "Paul Graham",
    type: "essay",
    content: `The way to get startup ideas is not to try to think of startup ideas. It's to look for problems, preferably problems you have yourself.

The very best startup ideas tend to have three things in common: they're something the founders themselves want, that they themselves can build, and that few others realize are worth doing. Microsoft, Apple, Yahoo, Google, and Facebook all began this way.

### Well

When a startup launches, there have to be at least some users who really need what they're making — not just people who could see themselves using it one day, but who want it urgently.

Imagine a graph whose x axis represents all the people who might want what you're making and whose y axis represents how much they want it. You can either dig a hole that's broad but shallow, or one that's narrow and deep, like a well.

Made-up startup ideas are usually of the first type. Lots of people are mildly interested in a social network for pet owners.

Nearly all good startup ideas are of the second type. Microsoft was a well when they made Altair Basic. There were only a couple thousand Altair owners, but without this software they were programming in machine language.

### Self

Live in the future, then build what's missing.

That describes the way many if not most of the biggest startups got started. Neither Apple nor Yahoo nor Google nor Facebook were even supposed to be companies at first. They grew out of things their founders built because there seemed a gap in the world.

The verb you want to be using with respect to startup ideas is not "think up" but "notice." At YC we call ideas that grow naturally out of the founders' own experiences "organic" startup ideas. The most successful startups almost all begin this way.

### Filters

There are two more filters you'll need to turn off if you want to notice startup ideas: the unsexy filter and the schlep filter.

Most programmers wish they could start a startup by just writing some brilliant code, pushing it to a server, and having users pay them lots of money. They'd prefer not to deal with tedious problems or get involved in messy ways with the real world.

The schlep filter is so dangerous that I wrote a separate essay about it. I gave Stripe as an example - thousands of programmers knew how painful it was to process payments before Stripe. But when they looked for startup ideas they didn't see this one, because unconsciously they shrank from having to deal with payments.`
  },
  {
    code: "8g",
    title: "How to get startup ideas",
    author: "Jared Friedman",
    type: "video",
    content: `The first, most common mistake is believing that you need an amazing idea to get started. When Google started, it was the 20th search engine. And when Facebook started, it was the 20th social network. What made them successful wasn't a brilliant initial idea. It was a good enough initial idea, combined with great execution.

The third mistake is to start with a solution instead of a problem. We see this so commonly at YC that we have a term for it. It's called a "Solution In Search of a Problem," or a SISP.

### Evaluation Formula

Here is my idea quality score formula:
1. How big is this idea?
2. Founder/market fit - are the founders experts?
3. How sure are you that you're solving a big problem?
4. Do you have a new, important insight?

### Filters

The four filters that cause you to reject your best ideas:
1. **Schlep Filter** - rejecting ideas that seem hard (Stripe example)
2. **Unsexy Filter** - ideas in boring spaces (Gusto payroll example)
3. **Too Ambitious** - Sam Altman's "Hard Startups"
4. **Existing Competitors** - but you should err on the side of doing things with competitors

### 7 Recipes for Ideas (Best to Worst)

1. **Best**: Start with what your team is especially good at. This has automatic founder/market fit. Examples: SnapDocs (mortgage industry expert), Lattice (saw bad performance review software), Mixpanel (built internal analytics).

2. Think of things you wish someone else would build for you. Example: DoorDash founders wanted Thai food delivery in suburbs.

3. What would you work on for 10 years even if it didn't succeed? Warning: can lead to ideas without business model.

4. Look for recent changes - new tech, platforms, regulations. Example: PlanGrid put blueprints on iPads.

5. Find successful companies and look for variants. Warning: often produces "Uber for X" SISPs.

6. Crowdsource by talking to experts. Best if they're founders who know how to notice good ideas.

7. Look for broken industries. Warning: often has poor founder/market fit.`
  },
  {
    code: "DU",
    title: "Dalton & Michael: Where do great startup ideas come from?",
    author: "Dalton Caldwell, Michael Seibel",
    type: "video",
    content: `We've picked three successful YC companies to unpack: Airbnb, Coinbase, and Stripe.

Three common themes:
1. Timing was important - pre-existing products existed but there was opportunity to make 10x better
2. Most people thought these ideas were horrible
3. Each opportunity turned out to be BIGGER than founders knew

### Airbnb

Existing products: VRBO and Couchsurfing already existed.

Why they weren't great:
- No payment facilitation - had to pay cash/check/wire between strangers
- VRBO charged hosts to list (wrong model - hosts are the game)

Airbnb started because Joe and Nate needed rent money. They rented floor space during a conference. Personal problem.

Brian Chesky didn't realize payments were crucial until he forgot cash and the host thought he was a fraud.

All the investors said: "Strangers sleeping in your apartment is dangerous and weird." Couchsurfing ethos was anti-commercial.

### Coinbase

Circa 2011-2012 it was really hard to buy Bitcoin. Had to send money orders to foreign countries. Mount Gox kept getting hacked - reputation was "you can get money in but never out."

Brian Armstrong was exposed to the most naysayers:
- Bitcoin seen as tiny bubble market
- Getting a bank deal was "impossible"
- Even Brian's YC application was for P2P transfers, not buying Bitcoin

The product was incredibly simple: log in, enter amount, push button. One of the simplest products ever seen. But solved the right single problem.

### Stripe

Dalton set up credit card processing twice (2002, 2007). It was like applying for a mortgage - fax papers, personal guarantees, fraud checks, expensive minimums. Gnarly and opposite of easy.

Stripe's insight:
- Saw all YC friends suffering through Authorize.net
- Built for developers, not business people
- Most beautiful website and documentation (the "Apple" of payments)
- Beta invite created exclusivity buzz
- Most expensive product in market but people still desperate to use it

The "shit takes": Two 19-year-olds in banking? Most regulated space? Need Wells Fargo deal? PayPal already exists?

### Key Takeaway

Don't give a shit if:
1. There's an existing product (if users hate it)
2. Experts think it's a bad idea (if they won't be users)
3. Initial market math looks small - transformational tech has use cases you can't dream of

Execution is what matters. Talk is cheap. Execution is hard and expensive.`
  },
  {
    code: "91",
    title: "Why smart people have bad ideas",
    author: "Paul Graham",
    type: "essay",
    content: `We expected promising and unpromising applications. But we needed a third category: promising people with unpromising ideas.

### The Artix Phase

Viaweb wasn't our first startup. In 1995 we started Artix to put art galleries on the Web. Galleries didn't want to be online - it's not how the art business works. Dealers are the most technophobic people on earth.

Why did I spend 6 months on this? Because I didn't pay attention to users. I invented a model of the world that didn't correspond to reality.

Microsoft wasn't Paul Allen and Bill Gates' first company either. The first was Traf-o-data.

### The Still Life Effect

The biggest cause of bad ideas: you come up with a random idea, plunge into it, then at each point (day, week, month) feel you've put in so much time that this must be THE idea.

I spent a month painting three versions of a still life I set up in four minutes. At each point I thought it was too late to change.

### Muck

Putting galleries on the Web seemed cool. But where there's muck, there's brass - unpleasant work pays. Work people like doesn't pay well.

When we started Artix, I wanted to keep one foot in the art world. Going into business is like hang-gliding: do it wholeheartedly or not at all. The purpose of a startup is to make money. You can't have divided loyalties.

### Hyenas

We were afraid of "business" - thought e-commerce would be dominated by fearsome startups with $5M VC each. So we chose a less competitive market: art galleries.

We erred ridiculously far on the side of safety. VC-backed startups are too busy trying to spend money to get software written. The "lions" turned out not to have any teeth.

### A Familiar Problem

Most applicants haven't stopped to ask: of all the things we could do, is THIS the one with the best chance of making money?

Why did no one propose a new micropayments scheme? Newspapers are dying for a solution.

The problem: people spent 15-20 years solving problems others set for them. They're good at solving problems, but bad at choosing them.

### Copper and Tin

A hacker who has learned what to make, and not just how to make, is extraordinarily powerful.

Adding the ability to see things from others' point of view to raw brainpower is like adding tin to copper. The result is bronze - so much harder it seems a different metal.

Read Dale Carnegie's "How to Win Friends and Influence People." It deals with the most difficult problem: how to see things from other people's point of view instead of thinking only of yourself.`
  }
];

// Map for easy lookup
export const articleMap = new Map(startupIdeasArticles.map(a => [a.code, a]));

// Get articles by keyword matching
export function findRelevantArticles(query: string, limit: number = 3): CoreArticle[] {
  const keywords = query.toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  const scored = startupIdeasArticles.map(article => {
    const text = `${article.title} ${article.author} ${article.content}`.toLowerCase();
    let score = 0;
    
    for (const kw of keywords) {
      if (article.title.toLowerCase().includes(kw)) score += 10;
      else if (article.author.toLowerCase().includes(kw)) score += 5;
      else if (text.includes(kw)) score += 1;
    }
    
    return { article, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.article);
}

const stopWords = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'her', 'way', 'many', 'oil', 'sit', 'set', 'run', 'eat', 'far', 'sea', 'eye', 'ago', 'off', 'too', 'any', 'try', 'ask', 'end', 'why', 'let', 'put', 'say', 'she', 'try', 'way', 'own', 'say', 'too', 'old', 'tell', 'very', 'when', 'come', 'could', 'would', 'there', 'their', 'what', 'about', 'which', 'make', 'like', 'time', 'just', 'know', 'take', 'people', 'year', 'good', 'some', 'them', 'well', 'also', 'back', 'only', 'after', 'work', 'first', 'even', 'want', 'here', 'look', 'down', 'most', 'long', 'last', 'find', 'give', 'does', 'made', 'part', 'such', 'over', 'think', 'where', 'being', 'every', 'great', 'might', 'shall', 'still', 'those', 'while', 'again', 'place', 'made', 'live', 'where', 'after', 'back', 'only', 'know', 'take', 'year', 'good', 'some', 'them', 'well', 'also'
]);
