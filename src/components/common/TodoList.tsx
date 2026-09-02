import React, { useState, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './TodoList.css';
import { useTodoStore } from '../../store/useTodoStore';

interface TodoListProps {
  /** 请求父级打开「删除待办」确认对话框（由父级统一在主界面/侧边栏根级全屏渲染 ConfirmDialog） */
  onRequestDeleteTodo: (todoId: string) => void;
  /** 请求父级打开「清空已完成」确认对话框 */
  onRequestClearCompleted: () => void;
}

const TodoList: React.FC<TodoListProps> = memo(({ onRequestDeleteTodo, onRequestClearCompleted }) => {
  const [newTodo, setNewTodo] = useState<string>('');

  const { todos, addTodo, toggleTodo } = useTodoStore(
    useShallow((s) => ({
      todos: s.todos,
      addTodo: s.addTodo,
      toggleTodo: s.toggleTodo,
    })),
  );

  const handleAddTodo = () => {
    const trimmed = newTodo.trim();
    if (!trimmed) return;
    addTodo({ text: trimmed, completed: false });
    setNewTodo('');
  };

  // —— 二次确认：不再本地渲染 ConfirmDialog（之前 container=parent 导致弹框出现在侧边栏内部）
  //    改为回调父 TodoSidebar，由其在侧边栏根级（全屏 fixed 定位）渲染，与「删除页面」对话框一致。
  const handleDeleteTodo = (id: string) => {
    onRequestDeleteTodo(id);
  };

  const handleClearCompleted = () => {
    onRequestClearCompleted();
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
    </div>
  );
});

export default TodoList;
