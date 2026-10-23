# Changelog

## 0.1.0

First version, for Foxify 0.9.0 or newer.

- Validation of Foxify files when they are opened and saved, with the problems in the editor.
- "Call" above each endpoint: asks for the arguments and shows the response.
- "Run workflow" above each workflow, and workflows in the Test Explorer, one test per step.
- A run view with the request and response of every step.
- Environment file picker in the status bar, kept for each folder; `foxify.variables` for `--var`.
- The first run or call of a folder asks for its environment file, and a step that fails on an undefined variable suggests picking another one.
