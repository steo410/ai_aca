function downloadText(filename, text, type = "application/json") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportSftJsonl(examples) {
  const lines = examples.map((item) =>
    JSON.stringify({
      instruction: item.instruction.trim(),
      output: item.output.trim(),
      system: item.system?.trim() || "",
      tags: item.tags ?? [],
    }),
  );
  downloadText("sft_train.jsonl", `${lines.join("\n")}\n`, "application/jsonl");
}

export function exportPreferenceJsonl(preferences) {
  const lines = preferences.map((item) =>
    JSON.stringify({
      prompt: item.prompt.trim(),
      chosen: item.chosen.trim(),
      rejected: item.rejected.trim(),
    }),
  );
  downloadText(
    "preferences.jsonl",
    `${lines.join("\n")}\n`,
    "application/jsonl",
  );
}

export function exportBundle(state) {
  downloadText(
    "local_ai_academy_bundle.json",
    JSON.stringify(
      {
        format: "local-ai-academy-v1",
        exportedAt: new Date().toISOString(),
        ...state,
      },
      null,
      2,
    ),
  );
}

export async function importBundle(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (parsed.format && parsed.format !== "local-ai-academy-v1") {
    throw new Error("지원하지 않는 데이터 형식입니다.");
  }
  return parsed;
}
