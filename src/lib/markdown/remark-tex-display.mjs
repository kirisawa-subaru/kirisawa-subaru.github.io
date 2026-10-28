/**
 * Extends remark-math-extended so TeX display math `\[ … \]` renders the way
 * it is usually written in prose:
 *
 * 1. Block `\[` may start on a lazy continuation line and its content may run
 *    over lazy lines. Without this, a paragraph that starts with `8. …` (a
 *    list item) swallows every following `\[ … \]` block as escaped brackets.
 * 2. `\[ … \]` in the middle of a line renders as display math instead of
 *    two escaped brackets.
 *
 * Must be registered after remark-math-extended: micromark tries constructs
 * from later extensions first, and mdast-util-math (added by that plugin)
 * builds the nodes from the shared `mathFlow` / `mathText` token types.
 */

import { factorySpace } from 'micromark-factory-space';
import { markdownLineEnding } from 'micromark-util-character';
import { visit } from 'unist-util-visit';

const BACKSLASH = 92;
const LEFT_BRACKET = 91;
const RIGHT_BRACKET = 93;

/** Display math `\[ … \]` as a block, tolerant of lazy continuation lines. */
const mathFlowDisplay = {
  name: 'mathFlow',
  concrete: true,
  tokenize(effects, ok, nok) {
    const self = this;
    const tail = self.events[self.events.length - 1];
    const initialSize =
      tail && tail[1].type === 'linePrefix' ? tail[2].sliceSerialize(tail[1], true).length : 0;
    return start;

    function start(code) {
      effects.enter('mathFlow');
      effects.enter('mathFlowFence');
      effects.enter('mathFlowFenceSequence');
      effects.consume(code);
      return open;
    }

    function open(code) {
      if (code !== LEFT_BRACKET) return nok(code);
      effects.consume(code);
      effects.exit('mathFlowFenceSequence');
      effects.exit('mathFlowFence');
      return beforeContent;
    }

    function beforeContent(code) {
      if (code === null) return nok(code);
      if (markdownLineEnding(code)) {
        effects.enter('lineEnding');
        effects.consume(code);
        effects.exit('lineEnding');
        return contentStart;
      }
      if (code === BACKSLASH) {
        return effects.attempt({ tokenize: tokenizeClose, partial: true }, after, valueStart)(code);
      }
      effects.enter('mathFlowValue');
      return value(code);
    }

    function contentStart(code) {
      return initialSize
        ? factorySpace(effects, beforeContent, 'linePrefix', initialSize + 1)(code)
        : beforeContent(code);
    }

    function valueStart(code) {
      effects.enter('mathFlowValue');
      effects.consume(code);
      return valueAfterBackslash;
    }

    // `\\` is a TeX line break; a following `[` is its optional argument (`\\[2mm]`).
    function valueAfterBackslash(code) {
      if (code === BACKSLASH) {
        effects.consume(code);
        return value;
      }
      if (code === LEFT_BRACKET) return nok(code);
      return value(code);
    }

    function value(code) {
      if (code === null || code === BACKSLASH || markdownLineEnding(code)) {
        effects.exit('mathFlowValue');
        return beforeContent(code);
      }
      effects.consume(code);
      return value;
    }

    function after(code) {
      effects.exit('mathFlow');
      return ok(code);
    }
  },
};

function tokenizeClose(effects, ok, nok) {
  return start;

  function start(code) {
    effects.enter('mathFlowFence');
    effects.enter('mathFlowFenceSequence');
    effects.consume(code);
    return close;
  }

  function close(code) {
    if (code !== RIGHT_BRACKET) return nok(code);
    effects.consume(code);
    effects.exit('mathFlowFenceSequence');
    return factorySpace(effects, afterClose, 'whitespace');
  }

  function afterClose(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('mathFlowFence');
      return ok(code);
    }
    return nok(code);
  }
}

/** `\[ … \]` inside a line. Tokenized as text math; marked display below. */
const mathTextDisplay = {
  name: 'mathText',
  previous(code) {
    return code !== BACKSLASH || this.events[this.events.length - 1][1].type === 'characterEscape';
  },
  tokenize(effects, ok, nok) {
    let sizeOpen = 0;
    let size = 0;
    let token;
    return start;

    function start(code) {
      effects.enter('mathText');
      effects.enter('mathTextSequence');
      return sequenceOpen(code);
    }

    function sequenceOpen(code) {
      if (sizeOpen === 0 && code === BACKSLASH) {
        effects.consume(code);
        sizeOpen = 1;
        return sequenceOpen;
      }
      if (sizeOpen === 1 && code === LEFT_BRACKET) {
        effects.consume(code);
        sizeOpen = 2;
        return sequenceOpen;
      }
      if (sizeOpen < 2) return nok(code);
      effects.exit('mathTextSequence');
      return between(code);
    }

    function between(code) {
      if (code === null) return nok(code);
      if (code === BACKSLASH) {
        token = effects.enter('mathTextSequence');
        size = 0;
        return sequenceClose(code);
      }
      if (markdownLineEnding(code)) {
        effects.enter('lineEnding');
        effects.consume(code);
        effects.exit('lineEnding');
        return between;
      }
      effects.enter('mathTextData');
      return data(code);
    }

    function data(code) {
      if (code === null || code === BACKSLASH || markdownLineEnding(code)) {
        effects.exit('mathTextData');
        return between(code);
      }
      effects.consume(code);
      return data;
    }

    function sequenceClose(code) {
      if (size === 2) {
        effects.exit('mathTextSequence');
        effects.exit('mathText');
        return ok(code);
      }
      if (size === 0 && code === BACKSLASH) {
        effects.consume(code);
        size = 1;
        return sequenceClose;
      }
      if (size === 1 && code === RIGHT_BRACKET) {
        effects.consume(code);
        size = 2;
        return sequenceClose;
      }
      // `\\` (TeX line break) or any other command: keep it as content.
      if (size === 1 && code === BACKSLASH) {
        effects.consume(code);
        token.type = 'mathTextData';
        effects.exit('mathTextData');
        return between;
      }
      token.type = 'mathTextData';
      return data(code);
    }
  },
};

export default function remarkTexDisplay() {
  const data = this.data();
  (data.micromarkExtensions ??= []).push({
    flow: { [BACKSLASH]: mathFlowDisplay },
    text: { [BACKSLASH]: mathTextDisplay },
  });

  return (tree, file) => {
    const source = String(file.value ?? '');
    visit(tree, 'inlineMath', (node) => {
      const offset = node.position?.start.offset;
      if (offset === undefined || source.slice(offset, offset + 2) !== '\\[') return;
      node.data ??= {};
      node.data.hProperties = { className: ['language-math', 'math-display'] };
    });
  };
}
