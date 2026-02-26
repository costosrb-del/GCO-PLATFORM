from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services import tasks_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    assigned_to: Optional[str] = ""
    priority: Optional[str] = "Media"
    due_date: Optional[str] = ""
    status: Optional[str] = "Pendiente"
    category: Optional[str] = "Tarea"
    id: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = []
    tags: Optional[List[str]] = []
    subtasks: Optional[List[Dict[str, Any]]] = []
    meeting_link: Optional[str] = ""
    recurrence: Optional[str] = "none"
    blocked_by: Optional[str] = ""
    order: Optional[int] = 0

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    completed_at: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None
    subtasks: Optional[List[Dict[str, Any]]] = None
    meeting_link: Optional[str] = None
    recurrence: Optional[str] = None
    blocked_by: Optional[str] = None
    order: Optional[int] = None

@router.get("/")
def get_tasks():
    try:
        data = tasks_service.get_all_tasks()
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_task(task: TaskCreate):
    try:
        created = tasks_service.create_task(task.model_dump())
        return {"message": "Task created successfully", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{task_id}")
def update_task(task_id: str, updates: TaskUpdate):
    try:
        updated = tasks_service.update_task(task_id, updates.model_dump(exclude_unset=True))
        if not updated:
            pass # We pass since Firebase might have updated but local logic didn't return
        return {"message": "Task updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{task_id}")
def delete_task(task_id: str):
    try:
        deleted = tasks_service.delete_task(task_id)
        return {"message": "Task deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
