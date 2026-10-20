import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AttachmentPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  ThreadPrimitive,
  useAuiState,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { useState } from "react";
import { FeedbackBar } from "../prompt-kit/feedback-bar";
import { Loader } from "../prompt-kit/loader";
import { Message, MessageAction, MessageActions, MessageAvatar, MessageContent } from "../prompt-kit/message";
import { PromptSuggestion } from "../prompt-kit/prompt-suggestion";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../prompt-kit/reasoning";
import { Source, SourceContent, SourceTrigger } from "../prompt-kit/source";
import { ThinkingBar } from "../prompt-kit/thinking-bar";
import { Tool, type ToolPart } from "../prompt-kit/tool";
import { GenerativeBlocks } from "../fx/agent/deskSurface";
import { StreamMarkdown } from "./StreamMarkdown";

const SUGGESTIONS = [
  "把下面这段话改短，保留原意",
  "给这件事列一个可以勾选的检查清单",
  "把我说的这几项画成图：甲 12，乙 7，丙 3",
  "把要点整理成一张表",
];

function MarkdownText() {
  const text = useAuiState((s) => (s.part.type === "text" ? s.part.text : ""));
  const streaming = useAuiState((s) => s.message.status?.type === "running");
  if (!text) return streaming ? <Loader variant="typing" size="sm" /> : null;
  return (
    <GenerativeBlocks
      text={text}
      streaming={streaming}
      renderText={(body, live) => <StreamMarkdown text={body} streaming={live} />}
    />
  );
}

function ReasoningPart() {
  const text = useAuiState((s) => (s.part.type === "reasoning" ? s.part.text : ""));
  const streaming = useAuiState((s) => s.message.status?.type === "running");
  if (!text) return null;
  return (
    <Reasoning isStreaming={streaming}>
      <ReasoningTrigger className="pk-keep">思考过程</ReasoningTrigger>
      <ReasoningContent>
        <StreamMarkdown text={text} streaming={streaming} />
      </ReasoningContent>
    </Reasoning>
  );
}

function toolState(status: ToolCallMessagePartProps["status"], isError?: boolean): ToolPart["state"] {
  if (isError || status?.type === "incomplete") return "output-error";
  if (status?.type === "complete") return "output-available";
  if (status?.type === "running") return "input-streaming";
  return "input-available";
}

function ToolFallback({ toolName, args, result, status, toolCallId, isError }: ToolCallMessagePartProps) {
  const input = args && typeof args === "object" ? (args as Record<string, unknown>) : undefined;
  const output = result === undefined ? undefined : result;
  const errorText =
    status?.type === "incomplete" && status.error != null
      ? String(status.error)
      : isError && typeof result === "string"
        ? result
        : undefined;
  return (
    <Tool
      defaultOpen={status?.type !== "complete"}
      toolPart={{
        type: toolName,
        state: toolState(status, isError),
        input,
        output,
        toolCallId,
        errorText,
      }}
    />
  );
}

function SourcePart() {
  const part = useAuiState((s) => (s.part.type === "source" ? s.part : null));
  if (!part || part.sourceType !== "url") return null;
  return (
    <Source href={part.url}>
      <SourceTrigger label={part.title || part.url} />
      <SourceContent title={part.title || part.url} description={part.url} />
    </Source>
  );
}

function ReplyFeedback() {
  const [choice, setChoice] = useState<"up" | "down" | null>(null);
  const [open, setOpen] = useState(true);
  if (!open) return null;
  if (choice) {
    return <p className="copied-feedback-note">{choice === "up" ? "已记下：有帮助" : "已记下：没帮助"}</p>;
  }
  return (
    <FeedbackBar
      className="copied-feedback"
      title="这句回复有帮助吗"
      onHelpful={() => setChoice("up")}
      onNotHelpful={() => setChoice("down")}
      onClose={() => setOpen(false)}
    />
  );
}

function ThreadLabel() {
  const title = useAuiState((s) => s.threadListItem.title);
  const generic = !title || title === "Main Thread" || title === "New Thread";
  return <span>{generic ? "新对话" : title}</span>;
}

function AttachmentChip({ removable }: { removable?: boolean }) {
  return (
    <AttachmentPrimitive.Root className="copied-file">
      <AttachmentPrimitive.Name />
      {removable ? <AttachmentPrimitive.Remove className="copied-file-x">移除</AttachmentPrimitive.Remove> : null}
    </AttachmentPrimitive.Root>
  );
}

function BranchPicker() {
  return (
    <BranchPickerPrimitive.Root hideWhenSingleBranch className="copied-branch">
      <BranchPickerPrimitive.Previous>上一条</BranchPickerPrimitive.Previous>
      <span>
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next>下一条</BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
}

function AssistantMessage() {
  const running = useAuiState((s) => s.message.status?.type === "running");
  return (
    <MessagePrimitive.Root className="copied-msg assistant" data-role="assistant">
      <Message className="copied-msg-row">
        <MessageAvatar src="" alt="回复" fallback="回" />
        <div className="copied-msg-body">
          <MessageContent className="copied-msg-plain">
            <MessagePrimitive.Parts
              components={{ Text: MarkdownText, Reasoning: ReasoningPart, Source: SourcePart, tools: { Fallback: ToolFallback } }}
            />
          </MessageContent>
          <MessagePrimitive.Error>
            <ErrorPrimitive.Root className="copied-error">
              <ErrorPrimitive.Message />
            </ErrorPrimitive.Root>
          </MessagePrimitive.Error>
          <MessageActions className="copied-msg-foot">
            <BranchPicker />
            <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="copied-actions">
              <MessageAction tooltip="复制">
                <ActionBarPrimitive.Copy>复制</ActionBarPrimitive.Copy>
              </MessageAction>
              <MessageAction tooltip="重答">
                <ActionBarPrimitive.Reload>重答</ActionBarPrimitive.Reload>
              </MessageAction>
              <MessageAction tooltip="朗读">
                <ActionBarPrimitive.Speak>朗读</ActionBarPrimitive.Speak>
              </MessageAction>
              <MessageAction tooltip="停止朗读">
                <ActionBarPrimitive.StopSpeaking>停止朗读</ActionBarPrimitive.StopSpeaking>
              </MessageAction>
              <ActionBarMorePrimitive.Root>
                <ActionBarMorePrimitive.Trigger className="copied-ghost">更多</ActionBarMorePrimitive.Trigger>
                <ActionBarMorePrimitive.Content className="copied-menu" side="bottom" align="start">
                  <ActionBarPrimitive.ExportMarkdown asChild>
                    <ActionBarMorePrimitive.Item className="copied-menu-item">导出 Markdown</ActionBarMorePrimitive.Item>
                  </ActionBarPrimitive.ExportMarkdown>
                </ActionBarMorePrimitive.Content>
              </ActionBarMorePrimitive.Root>
            </ActionBarPrimitive.Root>
          </MessageActions>
          {running ? null : <ReplyFeedback />}
        </div>
      </Message>
    </MessagePrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="copied-msg user" data-role="user">
      <Message className="copied-msg-row user-row">
        <MessageAvatar src="" alt="你" fallback="你" />
        <MessageContent className="copied-msg-plain copied-msg-body">
          <MessagePrimitive.Attachments>{() => <AttachmentChip />}</MessagePrimitive.Attachments>
          <MessagePrimitive.Parts />
        </MessageContent>
      </Message>
      <div className="copied-msg-foot">
        <BranchPicker />
        <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="copied-actions">
          <ActionBarPrimitive.Edit>修改</ActionBarPrimitive.Edit>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

function EditComposer() {
  return (
    <MessagePrimitive.Root className="copied-msg user">
      <ComposerPrimitive.Root className="copied-edit">
        <ComposerPrimitive.Input />
        <div className="copied-actions">
          <ComposerPrimitive.Cancel className="copied-ghost">取消</ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send>保存</ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
}

function ThreadMessage() {
  const role = useAuiState((s) => s.message.role);
  const editing = useAuiState((s) => s.message.composer.isEditing);
  if (editing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return <AssistantMessage />;
}

function Composer({ canSend }: { canSend: boolean }) {
  return (
    <ComposerPrimitive.Root className="copied-composer">
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div className="copied-composer-shell">
          <ComposerPrimitive.Quote className="copied-quote">
            <ComposerPrimitive.QuoteText />
            <ComposerPrimitive.QuoteDismiss>取消引用</ComposerPrimitive.QuoteDismiss>
          </ComposerPrimitive.Quote>
          <ComposerPrimitive.Attachments>{() => <AttachmentChip removable />}</ComposerPrimitive.Attachments>
          <ComposerPrimitive.Input placeholder="输入消息。可以拖进图片或文本文件。" autoFocus aria-label="消息" />
          <div className="copied-actions">
            <ComposerPrimitive.AddAttachment className="copied-ghost">添加文件</ComposerPrimitive.AddAttachment>
            <AuiIf condition={(s) => !s.composer.dictation}>
              <ComposerPrimitive.Dictate className="copied-ghost">语音输入</ComposerPrimitive.Dictate>
            </AuiIf>
            <AuiIf condition={(s) => Boolean(s.composer.dictation)}>
              <ComposerPrimitive.StopDictation className="copied-ghost">停止语音</ComposerPrimitive.StopDictation>
            </AuiIf>
            <span className="copied-spacer" />
            {canSend ? (
              <>
                <AuiIf condition={(s) => !s.thread.isRunning}>
                  <ComposerPrimitive.Send>发送</ComposerPrimitive.Send>
                </AuiIf>
                <AuiIf condition={(s) => s.thread.isRunning}>
                  <ComposerPrimitive.Cancel>停止</ComposerPrimitive.Cancel>
                </AuiIf>
              </>
            ) : (
              <button type="button" disabled>
                先保存密钥
              </button>
            )}
          </div>
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
}

export function CopiedThreadList() {
  return (
    <ThreadListPrimitive.Root className="copied-threads">
      <ThreadListPrimitive.New>新对话</ThreadListPrimitive.New>
      <div className="copied-thread-items">
        <ThreadListPrimitive.Items>
          {() => (
            <ThreadListItemPrimitive.Root className="copied-thread-item">
              <ThreadListItemPrimitive.Trigger className="copied-thread-title">
                <ThreadLabel />
              </ThreadListItemPrimitive.Trigger>
              <ThreadListItemPrimitive.Delete className="copied-file-x">删除</ThreadListItemPrimitive.Delete>
            </ThreadListItemPrimitive.Root>
          )}
        </ThreadListPrimitive.Items>
      </div>
    </ThreadListPrimitive.Root>
  );
}

export function CopiedThread({ canSend }: { canSend: boolean }) {
  return (
    <ThreadPrimitive.Root className="copied-thread">
      <ThreadPrimitive.Viewport className="copied-viewport" turnAnchor="top">
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <div className="copied-welcome">
            <h2>写下来，直接发</h2>
            <p>可以画图表、表格、步骤和需要你填写的表单。数字用你刚说的那些。回答可以复制、重答、改上一句。</p>
            <div className="copied-suggestions">
              {SUGGESTIONS.map((prompt) => (
                <ThreadPrimitive.Suggestion key={prompt} prompt={prompt} send={canSend} asChild>
                  <PromptSuggestion className="pk-keep h-auto whitespace-normal text-left">{prompt}</PromptSuggestion>
                </ThreadPrimitive.Suggestion>
              ))}
            </div>
          </div>
        </AuiIf>
        <div className="copied-messages">
          <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
        </div>
        <ThreadPrimitive.ViewportFooter className="copied-footer">
          <AuiIf condition={(s) => s.thread.isRunning}>
            <ThinkingBar className="copied-thinking" text="正在写" />
          </AuiIf>
          <ThreadPrimitive.ScrollToBottom className="copied-jump">回到底部</ThreadPrimitive.ScrollToBottom>
          <Composer canSend={canSend} />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
