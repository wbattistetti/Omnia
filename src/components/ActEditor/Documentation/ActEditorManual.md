# ActEditor Manual

## Overview
ActEditor is a modular React component designed to manage and display a set of actions (with drag & drop) and conversational response flows. It is intended for use in applications where users need to visually compose, organize, or trigger actions and responses, such as chatbot builders, workflow editors, or automation tools.

---

## What Does ActEditor Do?
- **Displays a grid of draggable actions** (e.g., send message, call API, assign value, etc.)
- **Allows drag & drop of actions** into other editors or flows
- **Includes a ResponseEditor** for managing conversational states and transitions (normal, no match, no input, escalation, etc.)
- **Includes an ActionViewer** for visualizing and selecting available actions
- **Is fully modular and portable**: you can copy the entire folder into another React/TypeScript project

---

## Folder Structure

```
ActEditor/
  ActEditor.tsx            // Main entry point: layout and orchestration
  ActEditor.module.css     // Main styles for layout and header
  ActionList.tsx           // Renders the grid of available actions
  ActionItem.tsx           // Renders a single draggable action
  ActionItem.module.css    // Styles for ActionItem
  types.ts                 // TypeScript interfaces and types
  README.md                // Quick usage and structure
  ActEditorManual.md       // This detailed manual
  ResponseEditor/          // All code for the response flow editor
    ResponseEditor.tsx
    TreeView.tsx
    TreeNode.tsx
    icons.tsx
    types.ts
    useTreeNodes.ts
    ResponseEditor.module.css
    TreeNode.module.css
    README.md
  ActionViewer/            // (Optional) Additional action visualization logic
    ActionViewer.tsx
    ...
```

---

## Main Components

### ActEditor.tsx
- The main entry point.
- Handles the layout (header, body) and orchestrates the inclusion of ActionList, ResponseEditor, and ActionViewer.

### ActionList.tsx
- Renders a responsive grid of available actions.
- Handles dynamic column sizing based on container width.
- Uses ActionItem for each action.

### ActionItem.tsx
- Represents a single draggable action (icon + label).
- Handles drag & drop logic for integration with other editors.

### ResponseEditor/
- Contains all logic for managing conversational flows:
  - States: normal, no match, no input, escalation
  - Tree structure for prompts and actions
  - Drag & drop of nodes
  - Custom hooks for state management
  - Modular CSS for styles

### ActionViewer/
- (Optional) For advanced action visualization or selection logic.

---

## TypeScript & Styles
- All components are fully typed with TypeScript for safety and autocompletion.
- Styles are managed via CSS modules for maximum portability and encapsulation.

---

## Dependencies
- **React** (>=17)
- **lucide-react** (for icons)
- (Optional) **Tailwind CSS** if you want to use Tailwind classes, but not required if you use only the provided CSS modules.

---

## How to Integrate in Another Project
1. **Copy the entire `ActEditor` folder** (including all subfolders and files) into your new project's `src/components/` directory.
2. **Install dependencies** in your new project:
   ```bash
   npm install react lucide-react
   # (Optional) npm install tailwindcss
   ```
3. **Import and use ActEditor** in your app:
   ```tsx
   import ActEditor from './components/ActEditor';

   function App() {
     return <ActEditor />;
   }
   ```
4. **Customize actions, styles, or flows** by editing the relevant files in the `ActEditor` folder.

---

## Customization & Extension
- **Add new actions**: Edit the `actions` array in `ActionList.tsx`.
- **Change styles**: Edit the CSS module files.
- **Extend response logic**: Work inside the `ResponseEditor` subfolder.
- **Add new viewers or editors**: Add new files/subfolders as needed.

---

## Support & Notes
- All code is modular and commented with executive summaries for quick understanding.
- If you encounter import errors after moving, check and update relative paths.
- For advanced integration (Redux, Context, etc.), wrap ActEditor as needed in your app.

---

**ActEditor is designed for maximum flexibility, clarity, and portability.** 