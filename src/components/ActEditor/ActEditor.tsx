// Executive summary: Main entry point for the Actions Editor component. Handles layout and orchestration of the actions grid.
import React from 'react';
import ActionList from './ActionViewer/ActionList';
import styles from './ActEditor.module.css';

type ActEditorProps = {
  ddt: any;
  translations: any;
  lang: string;
};

const ActEditor: React.FC<ActEditorProps> = ({ ddt, translations, lang }) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>Actions</h2>
      </div>
      <div className={styles.body}>
        <ActionList />
      </div>
    </div>
  );
};

export default ActEditor;