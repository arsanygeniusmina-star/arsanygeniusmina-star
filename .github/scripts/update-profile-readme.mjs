// Updates the profile README's live public-repository feed.
// Only public repositories are listed here; curated featured projects remain hand-picked.
const owner = "arsanygeniusmina-star";
const api = "https://api.github.com";
const headers = {
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(process.env.GITHUB_TOKEN ? { "Authorization": `Bearer ${process.env.GITHUB_TOKEN}` } : {})
};

const response = await fetch(`${api}/users/${owner}/repos?per_page=100&sort=updated&type=owner`, { headers });
if (!response.ok) throw new Error(`GitHub API failed: ${response.status} ${await response.text()}`);
const repos = (await response.json())
  .filter(repo => !repo.fork && !repo.archived && repo.name.toLowerCase() !== owner.toLowerCase())
  .sort((a, b) => new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at))
  .slice(0, 6);

const date = value => value ? new Date(value).toISOString().slice(0, 10) : "date unavailable";
const rows = repos.length
  ? repos.map((repo, index) => {
      const description = (repo.description || "A project in progress.").replace(/[|\r\n]/g, " ").slice(0, 150);
      const language = repo.language || "Exploration";
      return `| ${String(index + 1).padStart(2, "0")} | [**${repo.name}**](${repo.html_url}) | ${description} | ${language} | ${date(repo.pushed_at || repo.updated_at)} |`;
    }).join("\n")
  : "_No public repositories were returned by the GitHub API this run._";

const block = [
  "| # | Repository | Signal | Primary language | Last pushed |",
  "|:--:|---|---|---|:---:|",
  rows,
  "",
  "[Browse every repository →](https://github.com/arsanygeniusmina-star?tab=repositories)"
].join("\n");

const path = "README.md";
const readResponse = await fetch(`${api}/repos/${owner}/${owner}/contents/${path}`, { headers });
if (!readResponse.ok) throw new Error(`Could not read README: ${readResponse.status} ${await readResponse.text()}`);
const file = await readResponse.json();
if (!file.content || !file.sha) throw new Error("Could not retrieve README content and SHA");
const content = Buffer.from(file.content, "base64").toString("utf8");

function replaceBetween(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Missing or invalid markers: ${startMarker}`);
  return source.slice(0, start + startMarker.length) + "\n" + replacement + "\n" + source.slice(end);
}

let updated = replaceBetween(content, "<!-- LIVE-PROJECTS:START -->", "<!-- LIVE-PROJECTS:END -->", block);
updated = replaceBetween(updated, "<!-- LAST-UPDATED:START -->", "<!-- LAST-UPDATED:END -->", new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC");
if (updated === content) {
  console.log("README is already current.");
  process.exit(0);
}

const write = await fetch(`${api}/repos/${owner}/${owner}/contents/${path}`, {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "chore: refresh live profile project feed",
    content: Buffer.from(updated, "utf8").toString("base64"),
    sha: file.sha
  })
});
if (!write.ok) throw new Error(`Could not update README: ${write.status} ${await write.text()}`);
console.log("Profile README refreshed with live public repository activity.");
