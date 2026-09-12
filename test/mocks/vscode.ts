export const StatusBarAlignment = {
  Left: 1,
  Right: 2
};

export const window = {
  createStatusBarItem: (alignment: number, priority: number) => ({
    alignment,
    priority,
    text: '',
    tooltip: '',
    command: '',
    show: () => {},
    hide: () => {},
    dispose: () => {}
  }),
  registerTreeDataProvider: () => ({ dispose: () => {} }),
  showInformationMessage: () => Promise.resolve(),
  showWarningMessage: () => Promise.resolve(),
  showTextDocument: () => Promise.resolve()
};

export const workspace = {
  getConfiguration: () => ({
    get: (key: string) => undefined
  }),
  openTextDocument: () => Promise.resolve({})
};

export const commands = {
  registerCommand: (cmd: string, handler: Function) => ({ dispose: () => {} })
};
