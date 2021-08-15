# **Contributing**

> WARNING: Do not use the main branch for contributing, always use the dev branch.

Before submitting a contribution make sure:

1. You have tested both, the unbuilt and built version.

Code guidelines:

1. Every function must have a comment before its declaration specifying whether it is a private (not meant to be consumed by the user) or public function.
2. Every function must have at max 3 lines of comments before its declaration, describing its role.
3. Only camelCasing must be used.
4. Additional comments must be added when needed for helping the reader.
5. Names of any (functions, variables etc.) must hint what their role is.

Steps to make a contribution:

1. Fork the dev branch and clone it to your machine.
2. Add this repository as upstream to your forked branch. [Help](https://docs.github.com/en/github/collaborating-with-pull-requests/working-with-forks/configuring-a-remote-for-a-fork)
3. Create a new branch from the forked branch, make your changes to it, commit them and push it to your remote.
4. Create a pull request.
5. [Step-by-step guide to contributing on GitHub](https://www.dataschool.io/how-to-contribute-on-github/)

Branch naming guidelines:

1. Branch names should start with **feature-** , **documentation-** and **fix-** for adding or making changes to features, documentations and fixes respectively. Only camelCasing must be used and they should not contain any spaces.

    **Examples**: feature-moveToFolder, documentation-api, documentation-testing, documentation-contributing, fix-issueWithNameValidation.

Commit message guidelines:

1. Commit message should be in format of: **'[object] [action]: [specfic objects]'**.

    **Objects**: Functionalities, Tests, Documentation, Contributing Documentation and Testing Documentation.

    **Actions**: Added and Updated.

    **Examples**: 'Contributing Documentation Updated.' , 'Testing Documentation Updated.', 'Functionalities Added: moveToDepository, deleteFile and moveFile.' , 'Tests Updated: file.new, file.delete and file.copy.' , 'Documentation Added & Updated: newFile.'
