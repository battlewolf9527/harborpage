import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import './TodoSidebar.css';
import TodoList from '../common/TodoList';
import ConfirmDialog from '../common/ConfirmDialog';
import { useTodoStore } from '../../store/useTodoStore';
import { useClickOutside } from '../../hooks/useClickOutside';

const TodoSidebar: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const todos = useTodoStore((s) => s.todos);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const clearCompleted = useTodoStore((s) => s.clearCompleted);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // —— 删除/清空二次确认：与「删除页面」对话框同模式，放在侧边栏组件根级（DOM 并列）
  //    默认全屏 fixed 定位（不传 container="parent"），视觉在主界面中央弹出。
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'clear' | null>(null);
  const [todoIdToDelete, setTodoIdToDelete] = useState<string | null>(null);

  const uncompletedCount = useMemo(() => {
    return todos.filter(todo => !todo.completed).length;
  }, [todos]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const startAnimationTimeout = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setIsAnimating(false);
      timerRef.current = null;
    }, 300);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsAnimating(true);
    setIsExpanded(prev => !prev);
    startAnimationTimeout();
  }, [startAnimationTimeout]);

  useClickOutside(sidebarRef, {
    handler: () => {
      if (isExpanded) {
        setIsAnimating(true);
        setIsExpanded(false);
        startAnimationTimeout();
      }
    },
    enabled: isExpanded,
  });

  /* ── 二次确认：由 TodoList 触发 ─────────────────────────────────────────────── */
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

  return (
    <>
      <div 
        className="sidebar-icon" 
        onClick={toggleSidebar}
      >
        <div className="tooltip">待办事项{uncompletedCount > 0 ? ` (${uncompletedCount}项未完成)` : ''}</div>
        
        <div className="icon-container">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 6H16M8 12H16M8 18H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {uncompletedCount > 0 && (
            <div className="badge">{uncompletedCount}</div>
          )}
        </div>
      </div>

      <div ref={sidebarRef} className={`todo-sidebar ${isExpanded ? 'expanded' : ''} ${isAnimating ? 'animating' : ''}`}>
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

      {/* 删除/清空二次确认：放在侧边栏并列根级，全屏 fixed 定位 → 视觉在主界面中央。
         结构与 PagesSidebar 中「删除页面」ConfirmDialog 完全对齐（L330-342 同款）。
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