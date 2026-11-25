# Code signing

Release builds of `NetworkDiagramStudio.exe` are Authenticode signed with
[Azure Artifact Signing](https://learn.microsoft.com/azure/artifact-signing/) (formerly Trusted Signing), the
same way as Configuration Inspector, Network Toolkit and Server Inventory: the shared `networktoolkit-signing`
account, the `jpaull-codesign` Public Trust certificate profile and the `github-codesign` app registration.

## How it works

- The `portable` job of `.github/workflows/validate.yml` signs only on `main` (the release workflow calls it after
  a merge; a manual run on `main` signs too). Pull requests and other branches build unsigned, exactly as before.
- GitHub signs in to Azure with OpenID Connect (`azure/login`): Azure trusts tokens that GitHub issues for this
  repository's `main` branch, so no password, client secret or certificate is stored in GitHub.
- Signing happens right after `scripts/build-windows.ps1` and before `scripts/package-release.py`, so
  `SHA256SUMS.txt`, the native window/update/rollback check and the published asset all use the signed bytes.
  `azure/artifact-signing-action` signs with SHA-256 and an RFC 3161 timestamp from
  `http://timestamp.acs.microsoft.com`; `Get-AuthenticodeSignature` must then report `Valid` with a timestamp.
  A failed signature fails the job, so nothing is published.
- Published assets are never re-signed: signing changes the bytes and the published SHA-256.
- The in-app updater keeps checking the release SHA-256; signing does not change that check.
- Signing is skipped while `ARTIFACT_SIGNING_PROFILE` is unset. A `main` build then carries an "Unsigned build"
  warning and the release still publishes unsigned.

## Repository variables

Set under **Settings > Secrets and variables > Actions > Variables** (variables, not secrets: these are
identifiers). Use the same values as Configuration Inspector.

| Variable | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | Application (client) ID of the `github-codesign` app registration |
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `ARTIFACT_SIGNING_ENDPOINT` | `https://eus.codesigning.azure.net/` |
| `ARTIFACT_SIGNING_ACCOUNT` | `networktoolkit-signing` |
| `ARTIFACT_SIGNING_PROFILE` | `jpaull-codesign` |

## Azure setup (once for this repository)

The account, identity validation, certificate profile and app registration already exist. This repository needs:

1. A federated credential on the `github-codesign` app registration (Certificates & secrets > Federated
   credentials > Add credential, scenario "GitHub Actions deploying Azure resources"): organization
   `TechSavage1989`, repository `NetworkDiagramStudio`, entity **Branch** `main`. In GitHub's immutable-ID
   format its subject is `repo:TechSavage1989@44094233/NetworkDiagramStudio@1447863764:ref:refs/heads/main`,
   audience `api://AzureADTokenExchange`.
2. The repository variables above.

The app registration already holds the **Artifact Signing Certificate Profile Signer** role, so no new role is
needed. Certificates are short-lived and renewed by Azure automatically; the timestamp keeps old releases valid.
