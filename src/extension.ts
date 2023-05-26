// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as marked from "marked";
import { start } from "repl";

const notebookSubtreeSelectCommandName =
  "notebook-subtree-select.notebookSubtreeSelect" as const;

const gotoParentCellName = "notebook-subtree-select.gotoParentCell" as const;

type CellTree = {
  cell: vscode.NotebookCell;
  children: CellTree[];
  parent?: CellTree;
};

type CellTreeRoot = CellTree[];

function makeMarkedInstance() {
  return marked.marked.setOptions({mangle: false, headerIds: false});
}

/**
 * Returns the level of the final *heading* (subsequent text may be at a lower level??? test this)
 * @param text
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

  const markedInstance = makeMarkedInstance();
  markedInstance.use({ walkTokens });
  markedInstance.parse(text);
  return isHeadline;
}

function setParent(child: CellTree, parent: CellTree): CellTree {
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
      children.forEach((x) => setParent(x, tree));
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

function printSitch(fromwhere?: string) {
  console.log('--------------------------\nSITCH:');
  if (fromwhere) {
    console.log('FROM: ' + fromwhere);
  }
  console.log('active notebook editor:', vscode.window.activeNotebookEditor);
  const notebookEditorSelectionsReport = vscode.window.activeNotebookEditor?.selections.map(x => ({end: x.end, start: x.start, isEmpty: x.isEmpty}));
  console.log('active notebook editor selections:', notebookEditorSelectionsReport);
  console.log('active text editor:', vscode.window.activeTextEditor);
  console.log('active text editor selections:', vscode.window.activeTextEditor?.selections.map(x => ({end: x.end, start: x.start, isEmpty: x.isEmpty})));
  console.log('--END SITCH--')
}

function stopEditingCell(): void {
  printSitch('stopEditingCell');
  // vscode.commands.executeCommand('notebook.cell.quitEdit');
}

function selectSubtree(notebook: vscode.NotebookEditor): void {
  printSitch('selectSubtree');
  const selection = notebook.selection;
  if (selection === undefined || selection.isEmpty) {
    console.log('notebook selection not there.')
    const te = vscode.window.activeTextEditor;
    if (te) {
      const sel2 = te.selections;
      console.log('active text editor selection starts:', sel2.map(x => x.start));
    } else {
      console.log('active text editor not there either');
    }
  }
  if (selection !== undefined && !selection.isEmpty) {
    stopEditingCell();
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

/**
 * Returns first selected cell
 * @param notebook
 * @returns
 */
function selectedCell(
  notebook: vscode.NotebookEditor
): vscode.NotebookCell | null {
  const selection = notebook.selection;
  if (selection !== undefined && !selection.isEmpty) {
    console.log('selected cell:', selection.start);
    return notebook.notebook.cellAt(selection.start);
  }
  console.log('in selectedCell. no selected cell');
  printSitch('selectedCell');
  return null;
}

function gotoParentCell(notebook: vscode.NotebookEditor) {
  printSitch('gotoParentCell');
  const ctr = parseCellTreeRoot(notebook.notebook);
  const cell = selectedCell(notebook);
  if (cell) {
    const pcell = findCellTree(cell, ctr)?.parent?.cell;
    if (pcell) {
      const range = new vscode.NotebookRange(pcell.index, pcell.index);
      //stopEditingCell();
      notebook.selection = range;
      // notebook.selections = [range];
      // notebook.revealRange(range);
    }
  } 
}

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
      // vscode.window.showInformationMessage('Hello World from Notebook Subtree Select!');
      const notebook = vscode.window.activeNotebookEditor;
      if (notebook) {
        selectSubtree(notebook);
      } else {
        printSitch('subtreeSelect, failed to find notebook');
      }
    }
  );

  disposables.push(disposable);

  disposable = vscode.commands.registerCommand(gotoParentCellName, () => {
    const notebook = vscode.window.activeNotebookEditor;
    if (notebook) {
      gotoParentCell(notebook);
    } else {
      printSitch('gotoParentCell, failed to find notebook');
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
