Source code notes for reviewers
================================

This add-on has NO build step. There are no minifiers, bundlers (e.g.
webpack), template engines, or any other code-generation tools involved.

Every file in the submitted .xpi is plain, hand-written, human-readable
source code exactly as authored:

  manifest.json                          - add-on manifest
  background.js                          - starts the experiment API
  icon.svg                               - add-on icon
  api/searchAsList/schema.json           - WebExtension experiment schema
  api/searchAsList/implementation.js     - experiment API implementation

Build / reproduce instructions
-------------------------------
1. Take the 5 files/folders listed above, unmodified.
2. Zip them so that manifest.json sits at the root of the archive
   (not inside a subfolder).
3. Rename the resulting .zip to .xpi.

No operating system, compiler, Node/npm version, or any other tool is
required to reproduce this package - it is a direct, unprocessed zip of the
source files.

Environment
-----------
- OS: any (packaging is just standard zip)
- Runtime: Thunderbird 128 or later (WebExtension + Experiment API)
- No npm/node/build dependencies of any kind
