// an-dr: Confluence Axis - Background Service Worker
// Makes cross-origin Jira API requests on behalf of the content script,
// bypassing CORS restrictions.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action !== 'fetchJiraTitle') return false;

  const { issueKey, baseUrl } = msg;
  const url = `${baseUrl}/rest/api/2/issue/${issueKey}?fields=summary,status`;

  fetch(url, { credentials: 'include' })
    .then(res => {
      if (!res.ok) { sendResponse({ title: null, error: `HTTP ${res.status}` }); return; }
      return res.json();
    })
    .then(data => sendResponse({
      title:  data?.fields?.summary      ?? null,
      status: data?.fields?.status?.name ?? null,
    }))
    .catch(err => sendResponse({ title: null, error: err.message }));

  return true; // keep message channel open for async response
});
