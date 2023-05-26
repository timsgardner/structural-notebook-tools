// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as marked from "marked";

declare const CellIndexBrand: unique symbol;
declare const CellLevelBrand: unique symbol;
declare const MarkdownLevelBrand: unique symbol;

type CellIndex = number & { [CellIndexBrand]: void };
type CellLevel = number & { [CellLevelBrand]: void };
type MarkdownLevel = number & { [MarkdownLevelBrand]: void };

type CellLevelsArray = CellLevel[];

type CellTree = {
  cell: vscode.NotebookCell;
  children: CellTree[];
  parent?: CellTree;
};

type CellTreeRoot = CellTree[];

function findIndexForward<T>(
  arr: T[],
  start: number,
  predicate: (element: T, index: number) => boolean
): number {
  for (let i = start; i < arr.length; i++) {
    if (predicate(arr[i], i)) {
      return i;
    }
  }
  return -1;
}

function findIndexBackward<T>(
  arr: T[],
  start: number,
  predicate: (element: T, index: number) => boolean
): number {
  for (let i = start; i >= 0; i--) {
    if (predicate(arr[i], i)) {
      return i;
    }
  }
  return -1;
}

function getSubarrayFloodFill<T>(
  arr: T[],
  start: number,
  predicate: (element: T, index: number) => boolean
): T[] {
  let left = start;
  let right = start;

  while (left >= 0 && predicate(arr[left], left)) {
    left--;
  }

  while (right < arr.length && predicate(arr[right], right)) {
    right++;
  }

  return arr.slice(left + 1, right);
}

function setParent(parent: CellTree, child: CellTree): CellTree {
  child.parent = parent;
  return child;
}

function parseCellTree(
  cells: vscode.NotebookCell[],
  parentCellInx: number
): [CellTree, number] {
  const parentCell = cells[parentCellInx];
  if (isHeadlineCell(parentCell)) {
    // the previous level doesn't matter here, so giving it 0
    // if we care about cells that contain multiple markdown levels, we may have to
    // do some more tricks here. Or maybe it just works.
    const parentCmdl = concludingMarkdownLevel(
      parentCell.document.getText(),
      0 as any
    );
    const children: CellTree[] = [];
    function wrapup(inx: number): [CellTree, number] {
      const tree = { cell: parentCell, children };
      children.forEach((x) => setParent(tree, x));
      return [tree, i];
    }
    let i = parentCellInx + 1;
    while (i < cells.length) {
      const maybeChildCell = cells[i];
      if (isHeadlineCell(maybeChildCell)) {
        const cmdl = concludingMarkdownLevel(
          maybeChildCell.document.getText(),
          0 as any
        );
        if (parentCmdl < cmdl) {
          const [childTree, j] = parseCellTree(cells, i);
          children.push(childTree);
          i = j;
        } else {
          // we've reached a headline cell "above" the current cell
          // don't increment i, because it's at the place the next
          // parse should start
          return wrapup(i);
        }
      } else {
        const [childTree, j] = parseCellTree(cells, i);
        children.push(childTree);
        i = j;
      }
    }
    return wrapup(i);
  } else {
    return [{ cell: parentCell, children: [] }, parentCellInx + 1];
  }
}

function cellTreeCells(tree: CellTree): vscode.NotebookCell[] {
  return [tree.cell, ...tree.children.flatMap(cellTreeCells)];
}

function findCellTree(
  cell: vscode.NotebookCell,
  cellTreeRoot: CellTreeRoot
): CellTree | null {
  function findCellTreeStep(searchTree: CellTree): CellTree | null {
    if (searchTree.cell === cell) {
      return searchTree;
    }
    for (let index = 0; index < searchTree.children.length; index++) {
      const maybeTree = findCellTreeStep(searchTree.children[index]);
      if (maybeTree !== null) {
        return maybeTree;
      }
    }
    return null;
  }
  for (let i = 0; i < cellTreeRoot.length; i++) {
    const tree = cellTreeRoot[i];
    const maybeTree = findCellTreeStep(tree);
    if (maybeTree !== null) {
      return maybeTree;
    }
  }
  return null;
}

function parseCellTreeRoot(root: vscode.NotebookDocument): CellTreeRoot {
  // Only cells containing headlines may have children.
  // The children of a cell is all cells after the current cell,
  // until either the end of the document is reached, or a headline
  // cell is encountered with concluding depth less than that of the
  // parent cell. In which case, this cell is not included in the children
  // of the parent cell.

  const cells = root.getCells();
  const cellTreeRoot: CellTreeRoot = [];
  let rootChildrenInx = 0;
  while (rootChildrenInx < cells.length) {
    const [tree, j] = parseCellTree(cells, rootChildrenInx);
    cellTreeRoot.push(tree);
    rootChildrenInx = j;
  }
  console.log(cellTreeRoot);
  return cellTreeRoot;
}

/**
 * Returns the level of the final *heading* (subsequent text may be at a lower level??? test this)
 * @param text
 */
function concludingMarkdownLevel(
  text: string,
  startingMarkdownLevel: MarkdownLevel
): MarkdownLevel {
  let headingLevel = startingMarkdownLevel;

  const walkTokens = (token: marked.marked.Token) => {
    if (token.type === "heading") {
      headingLevel = token.depth as MarkdownLevel;
    }
  };

  const markedInstance = marked.marked.setOptions({});

  // marked.marked.use({ walkTokens });
  markedInstance.use({ walkTokens });
  markedInstance.parse(text);

  return headingLevel;
}

function isHeadlineCell(cell: vscode.NotebookCell): boolean {
  if (cell.kind !== vscode.NotebookCellKind.Markup) {
    return false;
  }

  const text = cell.document.getText();
  let isHeadline = false;

  const walkTokens = (token: marked.marked.Token) => {
    if (token.type === "heading") {
      isHeadline = true;
    }
  };

  const markedInstance = marked.marked.setOptions({});

  // marked.marked.use({ walkTokens });
  markedInstance.use({ walkTokens });
  markedInstance.parse(text);
  return isHeadline;
}

function cellLevels(notebook: vscode.NotebookEditor): CellLevelsArray {
  const cells = notebook.notebook.getCells();
  const cellLevelArray: CellLevelsArray = [];
  let currentLevel = 0 as CellLevel;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.kind === vscode.NotebookCellKind.Code) {
      cellLevelArray.push(currentLevel);
    } else {
      currentLevel = concludingMarkdownLevel(
        cell.document.getText(),
        currentLevel as unknown as MarkdownLevel
      ) as unknown as CellLevel;
      cellLevelArray.push(currentLevel);
    }
  }
  return cellLevelArray;
}

function cellTreeLevels(notebook: vscode.NotebookEditor): number[] {
  const cells = notebook.notebook.getCells();
  const cellTreeArray: number[] = [];
  let previousLevel = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    cellTreeArray.push(previousLevel);
    if (isHeadlineCell(cell)) {
      const cmdl = concludingMarkdownLevel(
        cell.document.getText(),
        previousLevel as any
      );
      previousLevel = cmdl;
    }
  }
  vscode.window.showInformationMessage(
    `Computed tree levels: ${cellTreeArray}`
  );
  return cellTreeArray;
}

function selectCurrentLevel(notebook: vscode.NotebookEditor): void {
  const cellSelection = notebook?.selection;
  if (cellSelection) {
    const start = cellSelection.start;
    const cLevels = cellLevels(notebook);
    const cellLevel = cLevels[start];
    // this is goofy
    const cellInxes = Array.from(
      { length: notebook.notebook.cellCount },
      (_, i) => i
    );
    const levelCellInxes = getSubarrayFloodFill(
      cellInxes,
      start,
      (x) => cLevels[x] >= cellLevel
    );
    vscode.window.showInformationMessage(
      `Attempting to select: ${levelCellInxes}`
    );
    notebook.selections = [
      new vscode.NotebookRange(
        levelCellInxes[0],
        levelCellInxes[levelCellInxes.length - 1] + 1
      ),
    ];
  }
}

function selectSubtree(notebook: vscode.NotebookEditor): void {
  const selection = notebook.selection;
  if (selection !== undefined && !selection.isEmpty) {
    const cell = notebook.notebook.cellAt(selection.start);
    const root = parseCellTreeRoot(notebook.notebook);
    const tree = findCellTree(cell, root);
    if (tree) {
      const treeCells = cellTreeCells(tree);
      if (treeCells.length > 0) {
        notebook.selections = [
          new vscode.NotebookRange(
            treeCells[0].index,
            treeCells[treeCells.length - 1].index + 1
          ),
        ];
      }
    }
  }
}

const notebookSubtreeSelectCommandName =
  "notebook-subtree-select.notebookSubtreeSelect";
const cellLevelCommandName = "notebook-subtree-select.cellLevel";

const disposables: vscode.Disposable[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "notebook-subtree-select" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    notebookSubtreeSelectCommandName,
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      // vscode.window.showInformationMessage('Hello World from Notebook Subtree Select!');
      const notebook = vscode.window.activeNotebookEditor;
      if (notebook) {
        selectSubtree(notebook);
      }
    }
  );
  disposables.push(disposable);

  context.subscriptions.push(disposable);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  disposable = vscode.commands.registerCommand(cellLevelCommandName, () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    // vscode.window.showInformationMessage('Hello World from Notebook Subtree Select!');
    const notebook = vscode.window.activeNotebookEditor;
    const cellSelection = notebook?.selection;
    if (cellSelection) {
      const start = cellSelection.start;
      const levels = cellLevels(notebook);
      const level = levels[start];
      vscode.window.showInformationMessage(`Cell level: ${level}`);
    }
  });
  disposables.push(disposable);

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
  // not sure I really need to do this
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables.length = 0;
}
