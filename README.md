# Structural Notebook Tools

**Structural Notebook Tools** is a Visual Studio Code extension for _directly_ traversing and editing VSC notebooks in terms of the _tree of cells_ implied by markdown headings.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Features

This extension allows more structured editing of notebooks than is provided by Visual Studio Code's defaults. In particular, it provides commands and keybindings to navigate and edit the notebook in terms of the cell hierarchy implied by markdown headings.

These commands run directly in the notebook's command mode.

- Quickly navigate the tree
- Select subtrees
- Increment and decrement heading levels

Notebooks are assumed to use markdown as the language of their "markup" cells.

## Status

Work in progress. Names and behavior can easily change, bits of it are buggy, and it isn't published yet. Pretty useful despite that though.

## Getting Started

### Prerequisites

Before you can use the Structural Notebook Tools extension, you need to have Visual Studio Code installed on your machine. You can download it [here](https://code.visualstudio.com/download).

### Installation

In order to use this extension, you'll need to install it in Visual Studio Code.

1. Clone the repository on your local machine:

   ```bash
   git clone https://github.com/yourusername/Structural-Notebook-Tools.git
   ```

2. Navigate into the project directory and install the necessary dependencies:

   ```bash
   cd Structural-Notebook-Tools
   npm install
   ```

3. Package the extension into a `.vsix` file using the `vsce` package tool. If `vsce` is not installed globally, you can do so by running `npm install -g vsce`.

   ```bash
   vsce package
   ```

   This will create a `.vsix` file in your directory.

4. Install the extension in Visual Studio Code by opening the Extensions view (`Ctrl+Shift+X`), clicking on the three dots at the top right of the Extensions view, selecting `Install from VSIX...`, and then selecting the `.vsix` file that you created.

For more information about packaging and publishing extensions, you can refer to the [official Visual Studio Code documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

## Usage

All keybindings below apply only to notebooks in **command mode**.

In the visualizations below, "top" is not a cell, but represents the root of the document (and therefore cannot be selected or have a cursor at it). I put it in the tree visualizations because otherwise I'd have to use a forest, which is more confusing. The other nodes represent the implicit level of the markdown tree, and the notebook would look like this:

```
# <some h1 heading>

## <some h2 heading>

<cell>

<cell>

## <some h2 heading>

<cell>

<cell>

# <some h1 heading>

<cell>

<cell>

```

Depth-first traversal is the same as just going to the next cell (ie, pushing the down key when in command mode), so it doesn't have a command. It looks like this:

<img src="doc_images/normal%20traversal.svg" width="600">

| Title                                       | Command                                           | Description                                                                                                                                                                                                                                                                                             | Default Keybinding | Traversal                                                        |
| ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| SNT: Decrement headings                     | `structural-notebook-tools.decrementHeadings`     | Decrement the heading level of all selected markdown                                                                                                                                                                                                                                                    |                    | ![bla](doc_images/normal%20traversal.svg)                        |
| SNT: Go to next breadth-first cell          | `structural-notebook-tools.gotoNextBreadthFirst`  | Navigates to the next cell using a breadth-first traversal                                                                                                                                                                                                                                              |                    | ![bla](doc_images/breadth%20first%20traversal.svg)               |
| SNT: Go to next cell backward and up        | `structural-notebook-tools.gotoBackwardAndUp`     | Moves to the previous sibling cell if present, or to parent cell. Inverse of `structural-notebook-tools.gotoNextSlideDown`.                                                                                                                                                                             | `p`                | ![bla](doc_images/previous%20sibling%20and%20up%20traversal.svg) |
| SNT: Go to next cell forward and over       | `structural-notebook-tools.gotoForwardAndOver`    | Moves to the next sibling cell if present, or to parent cell's next sibling                                                                                                                                                                                                                             | `n`                | ![bla](doc_images/next%20sibling%20and%20over%20traversal.svg)   |
| SNT: Go to next cell forward and up         | `structural-notebook-tools.gotoForwardAndUp`      | Moves to the next sibling cell if present, or to parent cell                                                                                                                                                                                                                                            |                    | ![bla](doc_images/next%20sibling%20and%20up%20traversal.svg)     |
| SNT: Go to next cell parent                 | `structural-notebook-tools.gotoParentCell`        | Navigates to the parent cell of the current cell                                                                                                                                                                                                                                                        | `u`                | ![bla](doc_images/go%20to%20parent%20traversal.svg)              |
| SNT: Go to next cell, sliding over and down | `structural-notebook-tools.gotoNextSlideDown`     | If the selected cell has children, move to the first child; otherwise, move to the next sibling if there is one. If there is not one, stay put. Gives the markdown tree a more structured feel by preventing the cursor from jumping up levels. Reverses `structural-notebook-tools.gotoBackwardAndUp`. | `i`                | ![bla](doc_images/slide%20over%20and%20down%20traversal.svg)     |
| SNT: Increment headings                     | `structural-notebook-tools.incrementHeadings`     | Increment the heading level of all selected markdown                                                                                                                                                                                                                                                    |                    |                                                                  |
| SNT: Insert notebook heading below          | `structural-notebook-tools.insertHeadingBelow`    | Inserts a heading cell below the current cell in the notebook, at the same markdown level as the current cell (that is, lateral to it in the tree).                                                                                                                                                     |                    |                                                                  |
| SNT: Select cell subtree                    | `structural-notebook-tools.notebookSubtreeSelect` | Selects the subtree of cells starting from the current cell                                                                                                                                                                                                                                             | `h`                |                                                                  |

## Contributing

ChatGPT feels that contributions are what make the open-source community an incredible place to learn, inspire, and create. Who am I to argue? Any contributions to **Structural Notebook Tools** are **greatly appreciated** (but might get rejected). Anyway, if you have a good idea lmk.

## License

Distributed under the MIT License. See `LICENSE` for more information.
