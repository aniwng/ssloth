// Who the site publishes as.
//
// This used to be a named persona ("Jordan Ellison, Founding Editor") with an
// invented biography claiming access to testing writeups and return-rate data.
// None of that was true, and a fabricated human expert is a much worse problem
// than an honest collective byline: it's the difference between "thin" and
// "misrepresentative". Roundups are drafted with the Claude API and reviewed by
// a person before publication, so the byline says that plainly and /how-we-pick/
// spells out the whole process.
//
// If a real, named person ever takes editorial ownership of the site, replace
// this with their actual name and a bio that is true of them — not before.
export const AUTHOR = {
  name: 'the Shopping Sloth editorial team',
  // Used where a byline needs to start a sentence or sit in structured data.
  displayName: 'Shopping Sloth editorial team',
  title: 'Shopping Sloth',
  summary:
    'Shopping Sloth is a small independent affiliate site. Roundups are drafted with AI research ' +
    'grounded in published reviews, then checked and edited by a person before anything goes live. ' +
    'We do not test products ourselves, and we say so on every article.',
}

/** Schema.org publisher/author node. An Organization, because that's what it is. */
export const AUTHOR_JSONLD = {
  '@type': 'Organization',
  name: 'Shopping Sloth',
}
