// The module 'vscode' contains the VS Code extensibility API
import * as vscode from "vscode";
import * as marked from "marked";

const notebookSubtreeSelectCommandName =
  "notebook-subtree-select.notebookSubtreeSelect" as const;

const gotoParentCellName = "notebook-subtree-select.gotoParentCell" as const;

type CellTreeBase = {
  children: CellTreeBranch[];
};

type CellTreeRoot = CellTreeBase & {
  root: true;
};

type CellTreeBranch = CellTreeBase & {
  root: false;
  cell: vscode.NotebookCell;
  parent: CellTree;
};

type PreconnectedCellTreeBranch = Omit<
  CellTreeBranch,
  "parent" | "children"
> & { children: PreconnectedCellTreeBranch[] };

type CellTree = CellTreeRoot | CellTreeBranch;

/********************************
 * Parse notebook tree
 *******************************/

function makeMarkedInstance() {
  return marked.marked.setOptions({ mangle: false, headerIds: false });
}

/**
 * Determines the concluding Markdown level of a given text starting from a specified Markdown level.
 *
 * @param text - The text to analyze.
 * @param startingMarkdownLevel - The starting Markdown level.
 * @returns The concluding Markdown level.
 */
function concludingMarkdownLevel(
  text: string,
  startingMarkdownLevel: number
): number {
  let headingLevel = startingMarkdownLevel;

  const walkTokens = (token: marked.marked.Token) => {
    if (token.type === "heading") {
      headingLevel = token.depth as number;
    }
  };

  const markedInstance = makeMarkedInstance();
  markedInstance.use({ walkTokens });
  markedInstance.parse(text);

  return headingLevel;
}

/**
 * Checks if the given notebook cell is a headline cell.
 *
 * @param cell - The notebook cell to check.
 * @returns A boolean indicating whether the cell is a headline cell.
 */
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

  const markedInstance = makeMarkedInstance();
  markedInstance.use({ walkTokens });
  markedInstance.parse(text);
  return isHeadline;
}

/**
 * Recursively add `parent` connections to a PreconnectedCellTreeBranch, thus converting it to a proper CellTreeBranch.
 * 
 * @param root 
 * @param tree 
 * @returns 
 */
function connectCellTree(
  root: CellTree,
  tree: PreconnectedCellTreeBranch
): CellTreeBranch {
  // For giggles, trying to do this in a "typesafe" way via legerdemain. Sort of a
  // dumb pseudo-functional trick, can remove later on the vanishingly remote chance
  // anyone has a notebook massive enough for the slight flutter of short-lived
  // allocation to make a snowball's difference in hell
  const rChildren = root.children;
  const x: CellTreeBranch = Object.assign(tree, { parent: root, children: [] });
  const y: CellTreeBranch = Object.assign(x, {
    children: rChildren.map((child) => connectCellTree(x, child)),
  });
  return y;
}

/**
 * Returns the tree without the parent connections.
 * We add those in the next step in `parseCellTree`.
 * Makes the recursion a little less annoying.
 * @param cells
 * @param cellInx
 * @returns
 */
function preconnectedCellTree(
  cells: vscode.NotebookCell[],
  cellInx: number
): [PreconnectedCellTreeBranch, number] {
  const parentCell = cells[cellInx];
  if (isHeadlineCell(parentCell)) {
    // the previous level doesn't matter here, so giving it 0
    // if we care about cells that contain multiple markdown levels, we may have to
    // do some more tricks here. Or maybe it just works.
    const parentCmdl = concludingMarkdownLevel(
      parentCell.document.getText(),
      0 as any
    );
    const children: PreconnectedCellTreeBranch[] = [];
    function wrapup(inx: number): [PreconnectedCellTreeBranch, number] {
      const tree: PreconnectedCellTreeBranch = {
        cell: parentCell,
        children,
        root: false,
      };
      return [tree, inx];
    }
    let i = cellInx + 1;
    while (i < cells.length) {
      const maybeChildCell = cells[i];
      if (isHeadlineCell(maybeChildCell)) {
        const cmdl = concludingMarkdownLevel(
          maybeChildCell.document.getText(),
          0 as any
        );
        if (parentCmdl < cmdl) {
          const [childTree, j] = preconnectedCellTree(cells, i);
          children.push(childTree);
          i = j;
        } else {
          // We've reached a headline cell "above" the current cell;
          // don't increment i, because it's at the place the next
          // parse should start
          return wrapup(i);
        }
      } else {
        const [childTree, j] = preconnectedCellTree(cells, i);
        children.push(childTree);
        i = j;
      }
    }
    return wrapup(i);
  } else {
    return [{ cell: parentCell, root: false, children: [] }, cellInx + 1];
  }
}

function parseCellTree(notebook: vscode.NotebookEditor): CellTreeRoot {
  // Only cells containing headlines may have children.
  // The children of a cell is all cells after the current cell,
  // until either the end of the document is reached, or a headline
  // cell is encountered with concluding depth less than that of the
  // parent cell. In which case, this cell is not included in the children
  // of the parent cell.
  const cells = Array.from({ length: notebook.notebook.cellCount }, (_, i) =>
    notebook.notebook.cellAt(i)
  );
  const preconnectedCells: PreconnectedCellTreeBranch[] = [];
  let i = 0;
  while (i < cells.length) {
    const [pctb, j] = preconnectedCellTree(cells, i);
    preconnectedCells.push(pctb);
    i = j;
  }
  // more legerdemain
  const root: CellTreeRoot = { root: true, children: [] };
  const childrenCells = preconnectedCells.map((pctb) =>
    connectCellTree(root, pctb)
  );
  root.children = childrenCells;
  return root;
}

/********************************
 * CellTree helpers
 *******************************/

function getCell(cellTree: CellTree): vscode.NotebookCell | null {
  if (cellTree.root) {
    return null;
  }
  return cellTree.cell;
}

function cellTreeCells(tree: CellTree): vscode.NotebookCell[] {
  const cells = tree.children.flatMap(cellTreeCells);
  if (tree.root) {
    return cells;
  }
  cells.unshift(tree.cell);
  return cells;
}

function findCellTree(
  cell: vscode.NotebookCell,
  cellTree: CellTree
): CellTreeBranch | null {
  // pre-order depth-first search
  if (!cellTree.root && cellTree.cell === cell) {
    return cellTree;
  }
  for (const ct of cellTree.children) {
    const v = findCellTree(cell, ct);
    if (v !== null) {
      return v;
    }
  }
  return null;
}

/**
 * Returns the provided notebook editor if available, or the active notebook editor.
 *
 * @param providedNotebook - Optional: The provided notebook editor. Nullable.
 * @returns The provided notebook editor, if available; otherwise, the active notebook editor. Returns null if neither is available.
 */
function providedOrActiveNotebook(
  providedNotebook?: vscode.NotebookEditor | null
): vscode.NotebookEditor | null {
  // Get the notebook editor to use
  let notebook2: vscode.NotebookEditor;

  if (providedNotebook == null) {
    // If no provided notebook editor, use the active notebook editor
    const nb = vscode.window.activeNotebookEditor;
    if (nb == null) {
      return null;
    }
    notebook2 = nb;
  } else {
    // Use the provided notebook editor
    notebook2 = providedNotebook;
  }

  return notebook2;
}

/**
 * Returns the CellTree object representing the hierarchical structure of notebook cells.
 * If a specific cell and notebook editor are provided, it finds the CellTree for that cell.
 * If no cell or notebook editor is provided, it uses the active notebook editor and the currently selected cell.
 *
 * Note that the entire hierarchy can be accessed from this CellTree object via the `parent` attribute.
 *
 * @param cell - Optional: The notebook cell to find the CellTree for.
 * @param notebook - Optional: The notebook editor containing the cell.
 * @returns The CellTree object representing the hierarchy starting at `cell`, or null if not found.
 */
function cellTree(
  cell?: vscode.NotebookCell | null,
  notebook?: vscode.NotebookEditor
): CellTreeBranch | null {
  // Get the notebook editor to use
  const notebook2 = providedOrActiveNotebook(notebook);
  if (notebook2 == null) {
    return null;
  }

  // Get the cell to find the CellTree for
  let cell2: vscode.NotebookCell;
  if (cell == null) {
    const selection = notebook2.selection;
    if (selection == null || selection.isEmpty) {
      return null;
    }
    cell2 = notebook2.notebook.cellAt(selection.start);
  } else {
    cell2 = cell;
  }

  // Parse the CellTree for the notebook
  const root = parseCellTree(notebook2);

  // Find the CellTree for the given cell
  return findCellTree(cell2, root);
}

/********************************
 * Misc
 *******************************/

/**
 * Resolves the input parameter to obtain the corresponding NotebookCell.
 *
 * @param cellOrIndex - The NotebookCell or its index to be resolved.
 * @param notebook - Optional: The notebook editor containing the cells.
 * @returns The resolved NotebookCell, or null if not found.
 */
function resolveNotebookCell(
  cellOrIndex: vscode.NotebookCell | number,
  notebook?: vscode.NotebookEditor | null
): vscode.NotebookCell | null {
  // If the input parameter is already a NotebookCell, return it
  if (typeof cellOrIndex !== "number") {
    return cellOrIndex;
  }

  // If the input parameter is an index, find the corresponding NotebookCell
  const notebook2 = providedOrActiveNotebook(notebook);
  if (notebook2 == null) {
    return null;
  }

  const index = cellOrIndex as number;
  if (index < 0 || index >= notebook2.notebook.cellCount) {
    return null;
  }

  return notebook2.notebook.cellAt(index);
}

/**
 * Sets the selection range in the provided notebook editor, including both the start and end cells.
 *
 * @param startCell - The start cell or its index of the selection range.
 * @param endCell - The end cell or its index of the selection range.
 * @param notebook - (Optional) The notebook editor in which to set the selection range. If not provided or null, the active notebook editor will be used.
 * @throws Error if the notebook editor or the cells cannot be found.
 */
function setSelectionInclusiveCellRange(
  startCell: vscode.NotebookCell | number,
  endCell: vscode.NotebookCell | number,
  notebook?: vscode.NotebookEditor | null
): void {
  const notebook2 = providedOrActiveNotebook(notebook);
  if (notebook2 == null) {
    throw new Error("Cannot find notebook editor.");
  }
  const startCell2 = resolveNotebookCell(startCell, notebook2);
  const endCell2 = resolveNotebookCell(endCell, notebook2);
  if (startCell2 == null || endCell2 == null) {
    throw new Error("Cannot find cells.");
  }
  notebook2.selection = new vscode.NotebookRange(
    startCell2.index,
    endCell2.index + 1
  );
}

function stopEditingCell(): void {
  vscode.commands.executeCommand("notebook.cell.quitEdit");
}

/**
 * Returns the first selected cell in the provided notebook editor or the active notebook editor.
 *
 * @param notebook - Optional: The notebook editor to retrieve the selected cell from.
 * @returns The first selected cell, or null if no cell is selected or no notebook editor is available.
 */
function selectedCell(
  notebook?: vscode.NotebookEditor | null
): vscode.NotebookCell | null {
  // Get the notebook editor to use
  const notebook2 = providedOrActiveNotebook(notebook);
  if (notebook2 == null) {
    return null;
  }

  // Retrieve the first selected cell, if available
  const selection = notebook2.selection;
  if (selection !== undefined && !selection.isEmpty) {
    return notebook2.notebook.cellAt(selection.start);
  }

  // No cell is selected
  return null;
}

/********************************
 * Selectors
 *******************************/

function selectSubtree(): void {
  const tree = cellTree(selectedCell());
  if (tree === null) {
    return;
  }
  if (tree.children.length > 0) {
    setSelectionInclusiveCellRange(
      tree.children[0].cell,
      tree.children[tree.children.length - 1].cell
    );
  }
}

function selectSiblings(notebook: vscode.NotebookEditor): void {
  const tree = cellTree(selectedCell());
  if (tree === null) {
    return;
  }
  const p = tree.parent;
  setSelectionInclusiveCellRange(
    p.children[0].cell,
    tree.children[tree.children.length - 1].cell
  );
}

/********************************
 * gotos
 *******************************/

function gotoCell(cell: vscode.NotebookCell): void {
  const notebook = providedOrActiveNotebook();
  if (notebook === null) {
    return;
  }
  const range = new vscode.NotebookRange(cell.index, cell.index + 1);
  notebook.selection = range;
  notebook.revealRange(range);
}

function gotoParentCell(): void {
  const tree = cellTree(selectedCell());
  if (tree === null) {
    return;
  }
  const p = tree.parent;
  if (p.root) {
    return;
  }
  setSelectionInclusiveCellRange(p.cell, p.cell);
}

/********************************
 * Activation
 *******************************/

const disposables: vscode.Disposable[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    notebookSubtreeSelectCommandName,
    () => {
      selectSubtree();
    }
  );

  disposables.push(disposable);

  disposable = vscode.commands.registerCommand(gotoParentCellName, () => {
    gotoParentCell();
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
