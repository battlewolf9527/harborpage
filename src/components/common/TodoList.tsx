import React, { useState, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './TodoList.css';
import ConfirmDialog from './ConfirmDialog';
import { useTodoStore } from '../../store/useTodoStore';

const TodoList: React.FC = memo(() => {
  const [newTodo, setNewTodo] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'clear' | null>(null);
  const [todoIdToDelete, setTodoIdToDelete] = useState<string | null>(null);

  const { todos, addTodo, toggleTodo, deleteTodo, clearCompleted } = useTodoStore(
    useShallow((s) => ({
      todos: s.todos,
      addTodo: s.addTodo,
      toggleTodo: s.toggleTodo,
      deleteTodo: s.deleteTodo,
      clearCompleted: s.clearCompleted,
    })),
  );

  const handleAddTodo = () => {
    const trimmed = newTodo.trim();
    if (!trimmed) return;
    addTodo({ text: trimmed, completed: false });
    setNewTodo('');
  };

  const handleDeleteTodo = (id: string) => {
    setTodoIdToDelete(id);
    setConfirmAction('delete');
    setShowConfirmDialog(true);
  };

  const handleClearCompleted = () => {
    setConfirmAction('clear');
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    if (confirmAction === 'delete' && todoIdToDelete) {
      deleteTodo(todoIdToDelete);
    } else if (confirmAction === 'clear') {
      clearCompleted();
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
    setTodoIdToDelete(null);
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
    setTodoIdToDelete(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTodo();
    }
  };

  return (
    <div className="todo-list">
      {/* 添加待办：始终放在最顶部，用户打开侧边栏第一眼就能看到，
          永远不被长列表挤出视口（CSS flex-shrink:0 保护）。 */}
      <div className="add-todo">
        <input
          type="text"
          placeholder="添加待办事项..."
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleAddTodo}>添加</button>
      </div>

      {/* 待办列表：放在中间，滚动只在这里发生（CSS flex:1 + min-height:0），
          长列表不会顶飞顶部添加栏或底部操作栏。 */}
      <div className="todo-items">
        {todos.map((todo) => (
          <div key={todo.id} className="todo-item">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span className={todo.completed ? 'completed' : ''}>{todo.text}</span>
            <button
              className="delete-todo"
              onClick={() => handleDeleteTodo(todo.id)}
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      {/* 底部统计 + 清空操作：仅当有待办时显示；flex-shrink:0 固定在底部。 */}
      {todos.length > 0 && (
        <div className="todo-footer">
          <span>{todos.filter(todo => !todo.completed).length} 项待完成</span>
          {todos.some(todo => todo.completed) && (
            <button onClick={handleClearCompleted}>清空已完成</button>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={confirmAction === 'delete' ? '确认删除' : '确认清空'}
        message={confirmAction === 'delete' ? '确定要删除这个待办事项吗？' : '确定要清空所有已完成的待办事项吗？'}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        container="parent"
      />
    </div>
  );
});

export default TodoList;