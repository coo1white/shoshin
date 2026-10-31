// @ts-check

export function renderStartPanel({ state, inputValue, onInput, onSubmit }) {
  const formWrap = document.createElement("div");
  formWrap.className = "panel";
  const label = document.createElement("label");
  label.textContent = "GitHub repo URL";
  label.setAttribute("for", "repo-input");
  formWrap.appendChild(label);

  const form = document.createElement("form");
  form.className = "input-row";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onSubmit();
  });

  const input = document.createElement("input");
  input.type = "text";
  input.id = "repo-input";
  input.placeholder = "https://github.com/owner/repo";
  input.value = inputValue;
  input.autocomplete = "off";
  input.addEventListener("input", (e) => {
    onInput(/** @type {HTMLInputElement} */ (e.target).value);
  });
  form.appendChild(input);

  const btn = document.createElement("button");
  btn.textContent = "Check";
  btn.type = "submit";
  if (state === "working") btn.disabled = true;
  form.appendChild(btn);
  formWrap.appendChild(form);

  const showExtra = state === "empty";
  if (showExtra) {
    const info = document.createElement("p");
    info.className = "small muted";
    info.textContent = "We copy the public files of this repo into a throwaway sandbox, run yokoten on them, and keep nothing. Public repos only.";
    formWrap.appendChild(info);

    const tryP = document.createElement("p");
    tryP.className = "small";
    const tryLabel = document.createElement("span");
    tryLabel.textContent = "Try one: ";
    tryP.appendChild(tryLabel);
    const examples = [
      { label: "Uniswap/v4-core", url: "https://github.com/Uniswap/v4-core" },
      { label: "OpenZeppelin/openzeppelin-contracts", url: "https://github.com/OpenZeppelin/openzeppelin-contracts" },
      { label: "jup-ag/jupiter-quote-api-node", url: "https://github.com/jup-ag/jupiter-quote-api-node" },
    ];
    examples.forEach((ex, idx) => {
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = ex.label;
      link.addEventListener("click", (ev) => {
        ev.preventDefault();
        onInput(ex.url);
        onSubmit();
      });
      tryP.appendChild(link);
      if (idx < examples.length - 1) {
        const sep = document.createElement("span");
        sep.textContent = ", ";
        tryP.appendChild(sep);
      }
    });
    formWrap.appendChild(tryP);

    const noRepoP = document.createElement("p");
    noRepoP.className = "small muted";
    noRepoP.textContent = "An AI coding agent can run commands, change files and push code. These checks show whether a repo tells it the rules.";
    formWrap.appendChild(noRepoP);
  }

  return formWrap;
}
