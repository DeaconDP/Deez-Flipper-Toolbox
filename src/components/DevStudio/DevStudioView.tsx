import { useEffect, useState } from "react";

import { FolderOpen, Loader2, Terminal, Upload } from "lucide-react";

import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { readDir } from "@tauri-apps/plugin-fs";

import { join } from "@tauri-apps/api/path";

import { toolsDetect, toolsRun, onToolOutput, type ToolDetectionResult } from "../../lib/tools";

import { loadSettings, updateSettings } from "../../lib/settings";

import { useFlipperStore } from "../../store/useFlipperStore";

import { storageMkdir, storageWriteFromLocal } from "../../lib/tauri";
import { TutorialBanner } from "../Tutorial/TutorialBanner";
import { FeatureContextBar } from "../ui/FeatureContextBar";



async function collectFiles(dir: string, base = dir): Promise<Array<{ local: string; rel: string }>> {

  const out: Array<{ local: string; rel: string }> = [];

  const entries = await readDir(dir);

  for (const entry of entries) {

    const local = await join(dir, entry.name);

    if (entry.isDirectory) {

      out.push(...(await collectFiles(local, base)));

    } else if (entry.isFile) {

      const rel = local.slice(base.length).replace(/^[/\\]/, "").replace(/\\/g, "/");

      out.push({ local, rel });

    }

  }

  return out;

}



export function DevStudioView() {

  const [tools, setTools] = useState<ToolDetectionResult | null>(null);

  const [projectDir, setProjectDir] = useState("");

  const [appId, setAppId] = useState("my_app");

  const [log, setLog] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);

  const [ufbtPath, setUfbtPath] = useState("");

  const isConnected = useFlipperStore((s) => s.isConnected);



  useEffect(() => {

    void toolsDetect().then(setTools);

    void loadSettings().then((s) => setUfbtPath(s.tools.ufbtPath ?? "ufbt"));

  }, []);



  useEffect(() => {

    const un = onToolOutput((line) => {

      setLog((prev) => [...prev.slice(-200), `[${line.stream}] ${line.line}`]);

    });

    return () => {

      void un.then((fn) => fn());

    };

  }, []);



  const append = (line: string) => setLog((p) => [...p, line]);



  const runUfbt = async (args: string[]) => {

    setBusy(true);

    try {

      const code = await toolsRun(ufbtPath, args, projectDir || undefined);

      append(`ufbt exited ${code}`);

    } catch (e) {

      append(String(e));

    } finally {

      setBusy(false);

    }

  };



  const scaffoldFap = async () => {

    if (!projectDir) {

      append("Pick a project directory first");

      return;

    }

    await runUfbt(["create", `APPID=${appId}`]);

  };



  const pickDir = async () => {

    const dir = await openDialog({ directory: true, multiple: false });

    if (dir && typeof dir === "string") setProjectDir(dir);

  };



  const saveUfbtPath = async () => {

    await updateSettings({

      tools: {

        ufbtPath,

        qflipperCliPath: (await loadSettings()).tools.qflipperCliPath,

        nodePath: (await loadSettings()).tools.nodePath,

      },

    });

    append("Saved uFBT path to settings");

  };



  const scaffoldJsApp = async () => {

    if (!tools?.node.found) {

      append("Node.js not found — install Node 20+ first.");

      return;

    }

    setBusy(true);

    try {

      const code = await toolsRun(

        "npx",

        ["@flipperdevices/create-fz-app@latest"],

        projectDir || undefined,

      );

      append(`Scaffold exited ${code}`);

    } catch (e) {

      append(String(e));

    } finally {

      setBusy(false);

    }

  };



  const buildJsApp = async () => {

    if (!projectDir) {

      append("Pick a project directory first");

      return;

    }

    setBusy(true);

    try {

      const code = await toolsRun("npm", ["run", "build"], projectDir);

      append(`npm run build exited ${code}`);

    } catch (e) {

      append(String(e));

    } finally {

      setBusy(false);

    }

  };



  const deployJsApp = async () => {

    if (!projectDir) {

      append("Pick a project directory first");

      return;

    }

    if (!isConnected) {

      append("Connect a Flipper to deploy.");

      return;

    }

    setBusy(true);

    try {

      append("Building…");

      const buildCode = await toolsRun("npm", ["run", "build"], projectDir);

      if (buildCode !== 0) {

        append(`Build failed (exit ${buildCode})`);

        return;

      }

      const distDir = `${projectDir.replace(/\\/g, "/")}/dist`;

      const files = await collectFiles(distDir);

      if (files.length === 0) {

        append("No files in dist/ — run build first.");

        return;

      }

      const remoteRoot = `/ext/apps/Scripts/${appId}`;

      await storageMkdir(remoteRoot);

      for (const file of files) {

        const remote = `${remoteRoot}/${file.rel}`;

        const parent = remote.slice(0, remote.lastIndexOf("/"));

        if (parent.length > remoteRoot.length) {

          await storageMkdir(parent);

        }

        append(`↑ ${file.rel}`);

        await storageWriteFromLocal(remote, file.local);

      }

      append(`Deployed ${files.length} file(s) to ${remoteRoot}`);

    } catch (e) {

      append(String(e));

    } finally {

      setBusy(false);

    }

  };



  return (

    <div className="flex-1 min-h-0 overflow-auto p-6 space-y-5">

      <TutorialBanner topicId="devstudio" />
      <FeatureContextBar topicId="devstudio" />

      <div>

        <h1 className="text-xl font-semibold text-primary">Dev Studio</h1>

        <p className="text-sm text-muted mt-1">Build and deploy FAP apps (uFBT) and JS apps from your PC.</p>

      </div>



      {tools && (

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">

          {Object.entries(tools).map(([key, t]) => (

            <div key={key} className={`p-2 rounded border ${t.found ? "border-green-900/50" : "border-border-subtle opacity-60"}`}>

              <div className="font-medium">{t.name}</div>

              <div className="text-dim truncate">{t.path ?? "not found"}</div>

            </div>

          ))}

        </div>

      )}



      <section className="space-y-2">

        <h2 className="text-sm font-medium">FAP apps (uFBT)</h2>

        <div className="flex flex-wrap gap-2 items-center">

          <button type="button" onClick={() => void pickDir()} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-border-subtle">

            <FolderOpen size={14} /> {projectDir || "Project folder"}

          </button>

          <input

            value={appId}

            onChange={(e) => setAppId(e.target.value)}

            className="px-2 py-1 text-sm rounded bg-surface border border-border-subtle"

            placeholder="APPID"

          />

          <input

            value={ufbtPath}

            onChange={(e) => setUfbtPath(e.target.value)}

            className="px-2 py-1 text-sm rounded bg-surface border border-border-subtle w-32"

            placeholder="ufbt path"

          />

          <button type="button" onClick={() => void saveUfbtPath()} className="text-xs px-2 py-1 rounded border border-border-subtle">Save path</button>

        </div>

        <div className="flex flex-wrap gap-2">

          <button type="button" disabled={busy} onClick={() => void scaffoldFap()} className="px-3 py-1.5 text-sm rounded bg-accent/20 text-accent">Create template</button>

          <button type="button" disabled={busy} onClick={() => void runUfbt([])} className="px-3 py-1.5 text-sm rounded border border-border-subtle">Build</button>

          <button type="button" disabled={busy} onClick={() => void runUfbt(["launch"])} className="px-3 py-1.5 text-sm rounded border border-border-subtle">Build + deploy</button>

          <button type="button" disabled={busy} onClick={() => void runUfbt(["vscode_dist"])} className="px-3 py-1.5 text-sm rounded border border-border-subtle">VS Code config</button>

        </div>

      </section>



      <section className="space-y-2">

        <h2 className="text-sm font-medium">JavaScript apps</h2>

        <p className="text-xs text-muted">

          Scaffold with the official template, build locally, then push to <code>/ext/apps/Scripts/</code> on the Flipper.

        </p>

        <div className="flex flex-wrap gap-2">

          <button

            type="button"

            disabled={busy || !tools?.node.found}

            onClick={() => void scaffoldJsApp()}

            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-border-subtle"

          >

            {busy ? <Loader2 size={14} className="animate-spin" /> : <Terminal size={14} />}

            Scaffold (npx)

          </button>

          <button

            type="button"

            disabled={busy || !projectDir}

            onClick={() => void buildJsApp()}

            className="px-3 py-1.5 text-sm rounded border border-border-subtle"

          >

            npm run build

          </button>

          <button

            type="button"

            disabled={busy || !projectDir || !isConnected}

            onClick={() => void deployJsApp()}

            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-accent/20 text-accent disabled:opacity-40"

          >

            <Upload size={14} /> Build + deploy to Flipper

          </button>

        </div>

      </section>



      <pre className="text-xs bg-black/40 border border-border-subtle rounded-md p-3 overflow-auto max-h-48 font-mono">

        {log.join("\n") || "Build output appears here…"}

      </pre>

    </div>

  );

}

