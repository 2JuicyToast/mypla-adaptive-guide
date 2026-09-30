# MyPLA Assistant Framework

Create the initial MyPLA ("My Planning Assistant") web app framework only. MyPLA is an adaptive personal planning assistant, not a generic to-do list. Build a clean, modern student-focused interface with a home dashboard, current tasks, upcoming tasks, and an Explore area for non-urgent productive opportunities. Task cards should show name, priority, due date, estimated time, energy requirement, and only the next unfinished action. Include clear actions for Start, Complete, and "I'm Stuck." Include a conversational/guided task-entry surface that can later accept natural-language input, plus UI placeholders for AI suggestions, assumption-check popups with Yes/No/Not Sure and correction text, weekly reflections, resource/tool recommendations, and interactive schedule notifications. Include a typical weekday schedule view and a "I'm free for X" quick action. The product philosophy is: the assistant suggests; the user decides. AI-generated changes must be shown as proposals and require user approval before meaningful state changes are committed. Do not build the actual AI logic or priority/scheduling logic yet; this is the UI/framework stage. Keep components modular and clearly named so a separate Python backend can later provide the business logic.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c1ddbdc0-dfc9-47a6-b96f-c1234eed04b5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
