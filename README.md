# Foxify for VS Code

Explore endpoints and run [Foxify](https://github.com/kikutano/foxify) API workflows without leaving the editor.

- **Problems as you save.** Foxify files are validated when you open and save them: an unknown endpoint, a missing param or a misspelled key is underlined where it is, with the suggestion of Foxify (`did you mean 'get_user'?`).
- **Call an endpoint.** A **▶ Call** link sits above every endpoint of an API file. It asks for the required params, lets you pick optional ones, and shows the response, whatever its status. The last values are remembered for each endpoint.
- **Run workflows.** **▶ Run workflow** at the top of a workflow, or the **Test Explorer**: each workflow is a test suite and each step a test, updated live as the run goes. A failed step shows why, at its line.
- **See every exchange.** The run view lists the steps; select one to see its checks, saved values, request and response.
- **Environments.** Pick the environment file (`env.local.yaml`, `env.dev.yaml`...) in the status bar. It is passed to every run and call.

The extension has no runtime dependency and no engine of its own: it runs the `foxify` binary, and reads its [JSON protocol](https://github.com/kikutano/foxify/blob/main/docs/protocol.md). What you see in VS Code is what `foxify run` does in CI.

## Requirements

[Foxify](https://github.com/kikutano/foxify#install) 0.9.0 or newer, on the `PATH` or set with `foxify.path`:

```bash
curl -fsSL https://raw.githubusercontent.com/kikutano/foxify/main/install.sh | sh
```

```powershell
irm https://raw.githubusercontent.com/kikutano/foxify/main/install.ps1 | iex
```

## Settings

| Setting | Default | |
|---|---|---|
| `foxify.path` | `foxify` | Path of the `foxify` binary. |
| `foxify.validateOnSave` | `true` | Validate Foxify files when they are opened and saved. |
| `foxify.variables` | `{}` | Variables passed with `--var` to every run and call, over the environment file, e.g. `{ "baseUrl": "http://localhost:8081" }`. Values are typed like YAML. |

## Commands

- **Foxify: Run Workflow**: runs the current workflow.
- **Foxify: Call Endpoint**: calls an endpoint of the current file, picked from a list.
- **Foxify: Select Environment**: the environment file passed with `-e`.
- **Foxify: Show Last Run**: reopens the run view.
- **Foxify: Validate File**: validates the current file now.

## How files are recognised

A YAML file with a top-level `endpoints:` or `steps:` key is a Foxify file; one with `steps:` is a workflow. Environment files are found by name: `env.yaml`, `env.*.yaml`, `env-*.yaml`, `environment.yaml`. Other YAML files are left alone.

A step cannot run on its own, since it uses the values saved by the steps before it: running a step from the Test Explorer runs its whole workflow.

**Secrets.** The run view shows requests as they are sent, `Authorization` headers included. They stay in VS Code: nothing is written to disk or sent anywhere.

## Development

No dependency to install: the extension is plain JavaScript on the VS Code API.

- **Run it**: open this folder in VS Code and press `F5` (**Run Extension**).
- **Unit tests**: `npm test` (Node's test runner, no VS Code needed).
- **Integration tests** run in a separate VS Code instance, with a temporary profile. They need a `foxify` binary, the Foxify test server and the examples of the [foxify repository](https://github.com/kikutano/foxify):

  ```bash
  # in the foxify repository: start the test server on http://localhost:5122
  dotnet run --project tests/Foxify.RealServer.Tests --urls http://localhost:5122

  # here
  FOXIFY_PATH=$(command -v foxify) FOXIFY_EXAMPLES=../foxify/docs node test/integration/run.js
  ```

- **Package**: `npm run package` builds a `.vsix` with [vsce](https://github.com/microsoft/vscode-vsce), which you can install with **Extensions: Install from VSIX...**.

`src/protocol.js` and `src/cli.js` use no VS Code API, and `media/run-view.js` renders the NDJSON events in any browser: they are meant to be reused by other front ends.

## License

[MIT](LICENSE)
