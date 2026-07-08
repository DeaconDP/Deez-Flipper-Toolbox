import { useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  formatsParseIr,
  formatsParseNfc,
  formatsParseSubghz,
  formatsReadLocalFile,
  formatsSerializeIr,
  formatsSerializeNfc,
  formatsSerializeSubghz,
  formatsWriteLocalFile,
  type IrFile,
  type NfcFile,
  type SubGhzFile,
} from "../../lib/formats";
import { storageWrite } from "../../lib/tauri";
import { TutorialBanner } from "../Tutorial/TutorialBanner";
import { FeatureContextBar } from "../ui/FeatureContextBar";

function textToBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}
import { useFlipperStore } from "../../store/useFlipperStore";

type EditorTab = "subghz" | "ir" | "nfc";

export function EditorsView() {
  const [tab, setTab] = useState<EditorTab>("subghz");
  const [raw, setRaw] = useState("");
  const [subghz, setSubghz] = useState<SubGhzFile | null>(null);
  const [ir, setIr] = useState<IrFile | null>(null);
  const [nfc, setNfc] = useState<NfcFile | null>(null);
  const [path, setPath] = useState("");
  const [msg, setMsg] = useState("");
  const isConnected = useFlipperStore((s) => s.isConnected);

  const loadFile = async () => {
    const file = await openDialog({
      filters: [
        { name: "Flipper files", extensions: ["sub", "ir", "nfc"] },
      ],
      multiple: false,
    });
    if (!file || typeof file !== "string") return;
    setPath(file);
    const content = await formatsReadLocalFile(file);
    setRaw(content);
    if (file.endsWith(".sub")) {
      setTab("subghz");
      setSubghz(await formatsParseSubghz(content));
    } else if (file.endsWith(".ir")) {
      setTab("ir");
      setIr(await formatsParseIr(content));
    } else if (file.endsWith(".nfc")) {
      setTab("nfc");
      setNfc(await formatsParseNfc(content));
    }
  };

  const saveLocal = async () => {
    let content = raw;
    if (tab === "subghz" && subghz) content = await formatsSerializeSubghz(subghz);
    if (tab === "ir" && ir) content = await formatsSerializeIr(ir);
    if (tab === "nfc" && nfc) content = await formatsSerializeNfc(nfc);
    const dest =
      path ||
      (await saveDialog({
        filters: [{ name: "Flipper file", extensions: [tab === "subghz" ? "sub" : tab === "ir" ? "ir" : "nfc"] }],
      }));
    if (!dest || typeof dest !== "string") return;
    await formatsWriteLocalFile(dest, content);
    setMsg(`Saved ${dest}`);
  };

  const pushToDevice = async () => {
    if (!isConnected) {
      setMsg("Connect Flipper first");
      return;
    }
    let content = raw;
    const name = path.split(/[/\\]/).pop() || `edited.${tab === "subghz" ? "sub" : tab}`;
    if (tab === "subghz" && subghz) content = await formatsSerializeSubghz(subghz);
    if (tab === "ir" && ir) content = await formatsSerializeIr(ir);
    if (tab === "nfc" && nfc) content = await formatsSerializeNfc(nfc);
    const remote = `/ext/${name}`;
    await storageWrite(remote, textToBase64(content));
    setMsg(`Uploaded to ${remote}`);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-6 gap-4 overflow-hidden">
      <TutorialBanner topicId="editors" />
      <FeatureContextBar topicId="editors" />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Signal Editors</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadFile()} className="text-sm px-3 py-1.5 rounded border border-border-subtle">Open file</button>
          <button type="button" onClick={() => void saveLocal()} className="text-sm px-3 py-1.5 rounded border border-border-subtle">Save</button>
          <button type="button" onClick={() => void pushToDevice()} className="text-sm px-3 py-1.5 rounded bg-accent text-black">Push to Flipper</button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["subghz", "ir", "nfc"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-sm rounded ${tab === t ? "bg-accent/20 text-accent" : "text-muted"}`}
          >
            {t === "subghz" ? "Sub-GHz" : t === "ir" ? "Infrared" : "NFC"}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
        <div className="flex flex-col min-h-0">
          <span className="text-xs text-muted mb-1">Raw</span>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="flex-1 min-h-0 font-mono text-xs p-2 rounded bg-black/30 border border-border-subtle resize-none"
          />
        </div>
        <div className="overflow-auto space-y-2 text-sm">
          {tab === "subghz" && subghz && (
            <>
              <Field label="Frequency" value={String(subghz.frequency)} onChange={(v) => setSubghz({ ...subghz, frequency: Number(v) })} />
              <Field label="Preset" value={subghz.preset} onChange={(v) => setSubghz({ ...subghz, preset: v })} />
              <Field label="Protocol" value={subghz.protocol} onChange={(v) => setSubghz({ ...subghz, protocol: v })} />
              {Object.entries(subghz.fields).map(([k, v]) => (
                <Field key={k} label={k} value={v} onChange={(val) => setSubghz({ ...subghz, fields: { ...subghz.fields, [k]: val } })} />
              ))}
            </>
          )}
          {tab === "ir" && ir && (
            <ul className="space-y-2">
              {ir.buttons.map((b, i) => (
                <li key={i} className="p-2 rounded bg-surface/30 text-xs">
                  <div className="font-medium">{b.name}</div>
                  <div className="text-muted">{b.protocol} addr {b.address} cmd {b.command}</div>
                </li>
              ))}
            </ul>
          )}
          {tab === "nfc" && nfc && (
            <>
              <Field label="Device type" value={nfc.device_type} onChange={(v) => setNfc({ ...nfc, device_type: v })} />
              <Field label="UID" value={nfc.uid} onChange={(v) => setNfc({ ...nfc, uid: v })} />
            </>
          )}
        </div>
      </div>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full mt-0.5 px-2 py-1 rounded bg-surface border border-border-subtle"
      />
    </label>
  );
}
