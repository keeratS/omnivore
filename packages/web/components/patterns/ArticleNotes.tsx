/* eslint-disable react/no-children-prop */
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { formattedShortTime } from '../../lib/dateFormatting'
import { Box, HStack, SpanBox, VStack } from '../elements/LayoutPrimitives'

import MarkdownIt from 'markdown-it'
import MdEditor, { Plugins } from 'react-markdown-editor-lite'
import 'react-markdown-editor-lite/lib/index.css'
import ReactMarkdown from 'react-markdown'
import throttle from 'lodash/throttle'
import { updateHighlightMutation } from '../../lib/networking/mutations/updateHighlightMutation'
import { Highlight } from '../../lib/networking/fragments/highlightFragment'
import { Button } from '../elements/Button'
import {
  ModalContent,
  ModalOverlay,
  ModalRoot,
} from '../elements/ModalPrimitives'
import { CloseButton } from '../elements/CloseButton'
import { StyledText } from '../elements/StyledText'
import remarkGfm from 'remark-gfm'
import MDEditorSavePlugin from './MDEditorSavePlugin'
import HandleFullScreen from './MDEditorSavePlugin'
import Counter from './MDEditorSavePlugin'
import { isDarkTheme } from '../../lib/themeUpdater'
import { RcEditorStyles } from './RcEditorStyles'

const mdParser = new MarkdownIt()

MdEditor.use(Plugins.TabInsert, {
  tabMapValue: 1, // note that 1 means a '\t' instead of ' '.
})

console.log()
MdEditor.use(Counter)

type NoteSectionProps = {
  targetId: string

  placeHolder: string
  mode: 'edit' | 'preview'

  sizeMode: 'normal' | 'maximized'
  setEditMode: (set: 'edit' | 'preview') => void

  text: string | undefined
  saveText: (text: string, completed: (success: boolean) => void) => void
}

export function ArticleNotes(props: NoteSectionProps): JSX.Element {
  const [lastSaved, setLastSaved] = useState<Date | undefined>(undefined)

  const saveText = useCallback(
    (text, updateTime) => {
      props.saveText(text, (success) => {
        if (success) {
          setLastSaved(updateTime)
        }
      })
    },
    [props]
  )

  return (
    <MarkdownNote
      targetId={props.targetId}
      placeHolder={props.placeHolder}
      sizeMode={props.sizeMode}
      text={props.text}
      saveText={saveText}
      lastSaved={lastSaved}
      fillBackground={false}
    />
  )
}

type HighlightViewNoteProps = {
  targetId: string

  placeHolder: string
  mode: 'edit' | 'preview'

  highlight: Highlight

  sizeMode: 'normal' | 'maximized'
  setEditMode: (set: 'edit' | 'preview') => void

  text: string | undefined
  updateHighlight: (highlight: Highlight) => void
}

export function HighlightViewNote(props: HighlightViewNoteProps): JSX.Element {
  const [lastSaved, setLastSaved] = useState<Date | undefined>(undefined)

  const saveText = useCallback(
    (text, updateTime) => {
      ;(async () => {
        const success = await updateHighlightMutation({
          annotation: text,
          highlightId: props.highlight?.id,
        })
        if (success) {
          setLastSaved(updateTime)
          props.highlight.annotation = text
          props.updateHighlight(props.highlight)
        }
      })()
    },
    [props]
  )

  return (
    <MarkdownNote
      targetId={props.targetId}
      placeHolder={props.placeHolder}
      sizeMode={props.sizeMode}
      text={props.text}
      saveText={saveText}
      lastSaved={lastSaved}
      fillBackground={true}
    />
  )
}

type MarkdownNote = {
  targetId: string

  placeHolder: string

  sizeMode: 'normal' | 'maximized'

  text: string | undefined
  fillBackground: boolean | undefined

  lastSaved: Date | undefined
  saveText: (text: string, updateTime: Date) => void
}

export function MarkdownNote(props: MarkdownNote): JSX.Element {
  const editorRef = useRef<MdEditor | null>(null)
  const [lastChanged, setLastChanged] = useState<Date | undefined>(undefined)
  const [errorSaving, setErrorSaving] = useState<string | undefined>(undefined)
  const isDark = isDarkTheme()

  const saveRef = useRef(props.saveText)

  useEffect(() => {
    saveRef.current = props.saveText
  }, [props.lastSaved, lastChanged])

  const debouncedSave = useMemo<
    (text: string, updateTime: Date) => void
  >(() => {
    const func = (text: string, updateTime: Date) => {
      saveRef.current?.(text, updateTime)
    }
    return throttle(func, 3000)
  }, [])

  const handleEditorChange = useCallback(
    (
      data: { text: string; html: string },
      event?: ChangeEvent<HTMLTextAreaElement> | undefined
    ) => {
      if (event) {
        event.preventDefault()
      }

      const updateTime = new Date()
      setLastChanged(updateTime)
      localStorage.setItem(`note-${props.targetId}`, JSON.stringify(data))
      debouncedSave(data.text, updateTime)
    },
    [props.lastSaved, lastChanged]
  )

  useEffect(() => {
    const saveMarkdownNote = () => {
      const md = editorRef.current?.getMdValue()
      if (md) {
        props.saveText(md, new Date())
      }
    }
    document.addEventListener('saveMarkdownNote', saveMarkdownNote)
    return () => {
      document.removeEventListener('saveMarkdownNote', saveMarkdownNote)
    }
  }, [props, editorRef])

  console.log('isDark: ', isDark)

  return (
    <VStack
      css={{
        width: '100%',
        ...RcEditorStyles(isDark, true),
        pr: '25px',
      }}
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.code.toLowerCase() === 'escape') {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      <MdEditor
        key="note-editor"
        ref={editorRef}
        autoFocus={true}
        defaultValue={props.text}
        placeholder={props.placeHolder}
        view={{ menu: true, md: true, html: false }}
        canView={{
          menu: true,
          md: true,
          html: true,
          both: false,
          fullScreen: false,
          hideMenu: false,
        }}
        plugins={[
          'tab-insert',
          'header',
          'font-bold',
          'font-italic',
          'font-underline',
          'font-strikethrough',
          'list-unordered',
          'list-ordered',
          'block-quote',
          'link',
          'auto-resize',
          'save',
        ]}
        style={{
          width: '100%',
          height: '180px',
        }}
        renderHTML={(text: string) => mdParser.render(text)}
        onChange={handleEditorChange}
      />
      <HStack
        css={{
          minHeight: '15px',
          width: '100%',
          fontSize: '9px',
          mt: '5px',
          color: '$thTextSubtle',
        }}
        alignment="start"
        distribution="start"
      >
        {errorSaving && (
          <SpanBox
            css={{
              width: '100%',
              fontSize: '9px',
              mt: '5px',
            }}
          >
            {errorSaving}
          </SpanBox>
        )}
        {props.lastSaved !== undefined ? (
          <>
            {lastChanged === props.lastSaved
              ? 'Saved'
              : `Last saved ${formattedShortTime(
                  props.lastSaved.toISOString()
                )}`}
          </>
        ) : null}
      </HStack>
    </VStack>
  )
}
