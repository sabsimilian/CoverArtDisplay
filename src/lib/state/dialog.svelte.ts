// Themed replacement for native alert()/confirm() — a plain OS dialog box
// would clash with this app's custom dark, frameless window chrome. Callers
// just `await alertDialog(...)` / `await confirmDialog(...)`, same call
// shape as the browser globals they replace. Backed by one <DialogHost/>
// mounted once in +layout.svelte; requests queue so only one is ever shown.

interface DialogRequest {
  id: number;
  kind: "alert" | "confirm";
  message: string;
  resolve: (value: boolean) => void;
}

let queue = $state<DialogRequest[]>([]);
let counter = 0;

export const dialogQueue = {
  get current(): DialogRequest | null {
    return queue[0] ?? null;
  },
};

function push(kind: DialogRequest["kind"], message: string): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { id: ++counter, kind, message, resolve }];
  });
}

export function alertDialog(message: string): Promise<void> {
  return push("alert", message).then(() => undefined);
}

export function confirmDialog(message: string): Promise<boolean> {
  return push("confirm", message);
}

export function resolveDialog(result: boolean): void {
  const [current, ...rest] = queue;
  if (!current) return;
  queue = rest;
  current.resolve(result);
}
