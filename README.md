# slack-polls
An Express.js app for native polling on Slack

## Requirements
1. Two available integration slots (incoming webhook + slash command)
2. Heroku + MongoLab Add-on (or any other PaaS which uses MongoLab)

## Usage

####Create a new poll
<code>/poll <strong>new</strong> {poll title} {poll option}</code> (up to 4 options)

**Note**: When called, if a poll exists already in the channel you are in, it is replaced with the new poll and all data from the previous poll is erased.
<p align="center"><img src="http://i.imgur.com/J0haZbs.gif"  /></p>

####Cast a vote for an open poll
<code>/poll <strong>vote</strong> {choice}</code>

**Note**: A user may only vote once. If a vote already exists for that user, it is overwritten by the new vote.

<p align="center"><img src="http://i.imgur.com/56DIvB2.gif" /></p>

####View the results for an open poll (Public)
<code>/poll <strong>results</strong></code>
<p align="center"><img src="http://i.imgur.com/Rc28HtO.gif"  /></p>

####View the results for an open poll (Private)
<code>/poll <strong>peek</strong></code>

<p align="center"><img src="http://i.imgur.com/BJ95SAG.gif"  /></p>

####In-app help
<code>/poll <strong>help</strong></code>

<p align="center"><img src="http://i.imgur.com/wSASzH3.png"  /></p>

## Quick Setup
- Fork this repository
- Deploy to Heroku (requires MongoLab Add-on)
- Copy Heroku URL to new **slash command** integration on Slack
- Create a new **Incoming Webhook** integration and copy the webhook URI
- Open slack and paste `/poll setup "YOUR-INCOMING-WEBHOOK-URI"`
- Done.

## Notes
- Once this app is running on Heroku, you may use it in as many different teams as you'd like.
- Only one active poll may be active (per channel) at any given time.

## Todo
- Enable support for up to 26 poll options (A-Z).

<p align="center"><code>***This app is not affiliated with, or endorsed by, Slack***</code></p>
