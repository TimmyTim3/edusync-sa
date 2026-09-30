<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep large demo generation in bounded database batches rather than one long RPC, because large attendance and marks inserts exceed statement time limits.
- Enforce register ownership in database policies and audit principal overrides server-side, because hiding edit buttons cannot secure attendance records.
- Store disciplinary report snapshots in a school-scoped archive, because saved hearing reports must remain reproducible.
