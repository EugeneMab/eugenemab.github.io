# GitHub PR and Commit Guidelines for Agents

When creating Pull Requests (PRs) and merging them, agents should avoid relying on default values if the branch names or commit history are messy or uninformative.

## 1. Avoid `--fill` with Auto-Generated Branch Names
Never use `gh pr create --fill` blindly if the branch name is automatically generated (e.g., `EugeneBunny/mabideapad_20260912_212645`) or if the commit messages are generic (e.g., `.` or `backup`). This results in a poor PR title and an unhelpful description.

## 2. Explicitly Define Title and Body
Always inspect the changes made in the branch and formulate a descriptive PR title and body. Use the following syntax:
```bash
gh pr create --title "[Component] Clear description of the changes" --body "- Detailed bullet point of change 1
- Detailed bullet point of change 2"
```

## 3. Merge Strategies
When merging PRs (especially using `--squash`), the PR title and description will become the final commit message on the `master` branch. Ensuring the PR has a good title and body guarantees a clean Git history.

## 4. Double Check Before Merging
Before running `gh pr merge`, ensure that the PR title and description accurately reflect the final changes. If you are instructed to push, create a PR, and merge all at once, always construct the title and body yourself rather than defaulting to the branch's raw commit data.
