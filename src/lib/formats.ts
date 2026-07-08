import { invoke } from "@tauri-apps/api/core";

export interface SubGhzFile {
  filetype: string;
  version: number;
  frequency: number;
  preset: string;
  custom_preset_module: string | null;
  custom_preset_data: string | null;
  protocol: string;
  fields: Record<string, string>;
  raw_data: string[];
}

export interface IrButton {
  name: string;
  protocol: string;
  address: string;
  command: string;
}

export interface IrFile {
  filetype: string;
  version: number;
  protocol: string;
  buttons: IrButton[];
}

export interface NfcFile {
  filetype: string;
  version: number;
  device_type: string;
  uid: string;
  fields: Record<string, string>;
  data_blocks: string[];
}

export const formatsParseSubghz = (content: string): Promise<SubGhzFile> =>
  invoke("formats_parse_subghz", { content });

export const formatsSerializeSubghz = (file: SubGhzFile): Promise<string> =>
  invoke("formats_serialize_subghz", { file });

export const formatsParseIr = (content: string): Promise<IrFile> =>
  invoke("formats_parse_ir", { content });

export const formatsSerializeIr = (file: IrFile): Promise<string> =>
  invoke("formats_serialize_ir", { file });

export const formatsParseNfc = (content: string): Promise<NfcFile> =>
  invoke("formats_parse_nfc", { content });

export const formatsSerializeNfc = (file: NfcFile): Promise<string> =>
  invoke("formats_serialize_nfc", { file });

export const formatsReadLocalFile = (path: string): Promise<string> =>
  invoke("formats_read_local_file", { path });

export const formatsWriteLocalFile = (path: string, content: string): Promise<void> =>
  invoke("formats_write_local_file", { path, content });
