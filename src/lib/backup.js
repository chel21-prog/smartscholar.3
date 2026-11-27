/** Saves a JSON file to the person's computer. Used as a safety copy before deletes, merges and undos. */
export function downloadJson(filename, data) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
