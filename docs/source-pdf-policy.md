# Source PDF policy

The repository must not store copyrighted source PDFs or scans.

The corpus may be grounded in PDFs that the curator has lawful access to, but the PDFs remain outside Git. The repo stores only:

- source metadata in `data/sources.json`
- candidate / verified artifact rows
- short excerpts or working renderings needed for the artifact database
- source URLs, edition notes, page references, and provenance notes

## Why PDFs stay out of Git

1. Many sources are copyrighted or have restricted redistribution terms.
2. PDF scans are large and make the repository brittle.
3. Git history preserves deleted files, so one mistaken upload is hard to undo cleanly.
4. The website only needs verified artifact rows, not full source books.

## Local workflow

Keep source PDFs in a private local directory, for example:

```txt
private-sources/
  desert-fathers-ward.pdf
  cantares-mexicanos-bierhorst.pdf
  popol-vuh-saravia-guarchaj.pdf
```

Create a local-only manifest at:

```txt
data/source-files.local.json
```

This file is ignored by Git. It can map private files to registered source IDs:

```json
[
  {
    "sourceId": "desert-fathers-ward",
    "localPath": "private-sources/desert-fathers-ward.pdf",
    "notes": "Private local copy for extraction and verification only. Do not commit."
  }
]
```

## Publication rule

Only publish rows after they pass validation:

```txt
source PDF -> candidate row -> review -> verified row -> generated website DB
```

The PDF itself never enters the public repository.
