import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import './TodoSidebar.css';
import TodoList from '../common/TodoList';
import { useTodoStore } from '../../store/useTodoStore';
import { useClickOutside } from '../../hooks/useClickOutside';

const TodoSidebar: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const todos = useTodoStore((s) => s.todos);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          <TodoList />
        </div>
      </div>
    </>
  );
};

export default TodoSidebar;