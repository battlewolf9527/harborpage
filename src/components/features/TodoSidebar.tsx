import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import './TodoSidebar.css';
import TodoList from '../common/TodoList';
import ConfirmDialog from '../common/ConfirmDialog';
import { useTodoStore } from '../../store/useTodoStore';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useFeatureDockStore } from '../../store/useFeatureDockStore';
import { useFeatureEntry } from '../../hooks/useFeatureEntry';

/** 待办身份色（入口球与面板共享的品牌色） */
const TODOS_TINT = '#6366f1';
const TODOS_TINT2 = '#ec4899';

/** 待办入口球图形（宿主决定入口内容） */
const todosGlyph = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 6H16M8 12H16M8 18H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TodoSidebar: React.FC = () => {
  // 面板开合：单一事实源在主界面 Dock（入口球与宿主共享）
  const isOpen = useFeatureDockStore((s) => !!s.open.todos);
  const setDockOpen = useFeatureDockStore((s) => s.setOpen);

  const todos = useTodoStore((s) => s.todos);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const clearCompleted = useTodoStore((s) => s.clearCompleted);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 按需挂载：open → 挂载并展开（滑入）；close → 先播退场动画再卸载
  const [present, setPresent] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // —— 删除/清空二次确认：与「删除页面」对话框同模式，放在侧边栏组件根级（DOM 并列）
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'clear' | null>(null);
  const [todoIdToDelete, setTodoIdToDelete] = useState<string | null>(null);

  const uncompletedCount = useMemo(() => {
    return todos.filter(todo => !todo.completed).length;
  }, [todos]);

  // —— 面板在场与展开态：完全由宿主 open 状态驱动。
  //    所有 setState 都只发生在「定时器回调」（异步）里，effect 本体只负责
  //    调度与清理 —— 规避 render 期 setState 在 React 并发/外部 store 触发
  //    的渲染中被丢弃的问题（表现为“open 已置位但面板从未驻留”）。
  useEffect(() => {
    // 打开：先挂载（收起态），供下方 effect 补 expanded 走滑入渐显节奏
    if (!isOpen) return;
    const mountTimer = window.setTimeout(() => setPresent(true), 0);
    return () => window.clearTimeout(mountTimer);
  }, [isOpen]);

  // 展开：面板在场后再延迟一帧补 expanded
  useEffect(() => {
    if (!isOpen || !present) return;
    const expandTimer = window.setTimeout(() => setExpanded(true), 30);
    return () => window.clearTimeout(expandTimer);
  }, [isOpen, present]);

  // 关闭：先收起开始退场，330ms 后真正卸载；同时清理确认框等瞬态，
  // 避免面板卸载后残留孤儿弹窗。
  useEffect(() => {
    if (isOpen || !present) return;
    const collapseTimer = window.setTimeout(() => {
      setExpanded(false);
      setShowConfirmDialog(false);
      setConfirmAction(null);
      setTodoIdToDelete(null);
    }, 0);
    const exitTimer = window.setTimeout(() => setPresent(false), 330);
    return () => {
      window.clearTimeout(collapseTimer);
      window.clearTimeout(exitTimer);
    };
  }, [isOpen, present]);

  useClickOutside(sidebarRef, {
    handler: () => {
      if (isOpen) {
        setDockOpen('todos', false);
      }
    },
    enabled: isOpen && present,
  });

  const handleRequestDeleteTodo = useCallback((todoId: string) => {
    setTodoIdToDelete(todoId);
    setConfirmAction('delete');
    setShowConfirmDialog(true);
  }, []);

  const handleRequestClearCompleted = useCallback(() => {
    setConfirmAction('clear');
    setTodoIdToDelete(null);
    setShowConfirmDialog(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'delete' && todoIdToDelete) {
      deleteTodo(todoIdToDelete);
    } else if (confirmAction === 'clear') {
      clearCompleted();
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
    setTodoIdToDelete(null);
  }, [confirmAction, todoIdToDelete, deleteTodo, clearCompleted]);

  const handleCancel = useCallback(() => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
    setTodoIdToDelete(null);
  }, []);

  // 倒置依赖：向主界面注册入口描述（未完成数驱动 tooltip 文案与角标）
  useFeatureEntry('todos', {
    glyph: todosGlyph,
    tint: TODOS_TINT,
    tint2: TODOS_TINT2,
    label: uncompletedCount > 0 ? `待办事项 · ${uncompletedCount} 项未完成` : '待办事项',
    badge: uncompletedCount > 0 ? String(uncompletedCount) : null,
  });

  return (
    <>
      {present && (
        <div
          ref={sidebarRef}
          className={`todo-sidebar ${expanded ? 'expanded' : ''} ${present && !expanded ? 'animating' : ''}`}
        >
          <div className="sidebar-content">
            <div className="sidebar-header">
              <h2>待办事项</h2>
            </div>
            <TodoList
              onRequestDeleteTodo={handleRequestDeleteTodo}
              onRequestClearCompleted={handleRequestClearCompleted}
            />
          </div>
        </div>
      )}

      {/* 删除/清空二次确认：放在侧边栏并列根级，全屏 fixed 定位 → 视觉在主界面中央。
         结构与 PagesSidebar 中「删除页面」ConfirmDialog 完全对齐。
         ⚠️ exactOptionalPropertyTypes: 不传 undefined；危险动作（删除）才 spreading confirmType/confirmText。 */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={confirmAction === 'delete' ? '确认删除' : '确认清空'}
        message={
          confirmAction === 'delete'
            ? '确定要删除这个待办事项吗？'
            : '确定要清空所有已完成的待办事项吗？'
        }
        {...(confirmAction === 'delete'
          ? { confirmType: 'danger' as const, confirmText: '删除' }
          : {})}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

export default TodoSidebar;
