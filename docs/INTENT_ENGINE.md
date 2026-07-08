# Intent Engine

## Purpose

The Intent Engine converts Founder natural language into structured intent objects that future Hoop Frens services can use.

This first version is non-AI. It uses simple static parsing rules so the platform has a typed contract before production AI, Firestore persistence, or workflow automation is introduced.

## Supported Intent Types

- `create`
- `continue`
- `review`
- `approve`
- `learn`
- `think`
- `search`
- `navigate`
- `unknown`

## Examples

| Input | Intent |
| --- | --- |
| `Spotlight Ashland` | `create` |
| `Continue Ashland` | `continue` |
| `Review today’s content` | `review` |
| `Approve the Parent Guide` | `approve` |
| `What do we know about Ferris State?` | `learn` |
| `Where should Hoop Frens go next?` | `think` |
| `Find D2 schools in Ohio` | `search` |
| `Open the Library` | `navigate` |

## Non-AI V1 Limitation

The current parser is deterministic and narrow. It recognizes approved static examples and close variants only. Unknown requests return `intentType: "unknown"` and request clarification.

No production AI calls are made. No OpenAI connection is present. No Firestore reads or writes are used.

## Future AI Integration Notes

Future AI integration should keep the same `IntentResult` contract and use the non-AI parser as a safe fallback.

Before production AI is added, the team should define:

- accepted input boundaries
- model routing
- confidence thresholds
- audit logging
- privacy rules
- clarification behavior
- Firestore persistence rules
