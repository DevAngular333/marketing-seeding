# Reddit r/opensource draft

## Title

A native Rust design studio built around a file format and agent boundary

## Body

I have been building an open-source desktop design studio in Rust, and the part that keeps forcing architectural decisions is not the canvas itself. It is keeping the document model, file interoperability, and automation surface consistent as the editor grows.

The current design is a native GPU-backed canvas with components, variables, Auto Layout, prototyping, comments, and a developer handoff view. The project reads and writes Figma-compatible `.fig` v106 archives. That compatibility layer has its own reader and writer instead of treating the file as a screenshot export, which makes malformed or unusual files the difficult cases.

There is also a local stdio MCP server with 22 typed tools and an embedded PTY panel for coding-agent CLIs. The boundary is deliberate: the studio owns document operations and the MCP transport, while any model or provider behavior belongs to the CLI the user chooses to run. The repository also contains code generators for React, Tailwind, SwiftUI, and Jetpack Compose.

The trade-offs are fairly direct. Rust gives a strong boundary around the document and rendering code, but it also makes the UI and file format work more explicit. A local-first desktop workflow avoids requiring a hosted document service, but collaboration and cloud editing are outside this project's scope. Supporting a Figma-compatible format improves interoperability while making the edge cases much more important than a clean demo file.

For people who maintain open-source editors or file formats: which cases would you test first in a project like this? I am especially interested in `.fig` edge cases, scene-graph and undo/redo invariants, native GPU rendering trade-offs, and where an MCP or agent interface should stop exposing editor internals.

This is a technical discussion about the implementation and testing questions. I am leaving links out of the post so the discussion can stand on its own.
