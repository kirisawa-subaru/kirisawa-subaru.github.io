/**
 * Normalises fenced-code language names so Shiki recognises them: `JAVA`,
 * `Python`, ` python` all work. Shiki's ids are lowercase.
 */

import { visit } from 'unist-util-visit';

export default function remarkCodeLang() {
  return (tree) => {
    visit(tree, 'code', (node) => {
      if (node.lang) node.lang = node.lang.trim().toLowerCase();
    });
  };
}
