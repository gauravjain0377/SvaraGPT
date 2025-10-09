import "./Sidebar.css";
import { useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import { v1 as uuidv1 } from "uuid";

function Sidebar() {
  const {
    allThreads,
    setAllThreads,
    currThreadId,
    setNewChat,
    setPrompt,
    setReply,
    setCurrThreadId,
    setPrevChats,
    projects,
    setProjects,
    currentProject,
    setCurrentProject,
    selectedProject,
    setSelectedProject,
    showCreateProject,
    setShowCreateProject,
    showRenameModal,
    setShowRenameModal,
    renameTarget,
    setRenameTarget,
    expandedProjects,
    setExpandedProjects,
    showMoveMenu,
    setShowMoveMenu,
    moveTarget,
    setMoveTarget,
    activeDropdown,
    setActiveDropdown,
  } = useContext(MyContext);

  const [activeSection, setActiveSection] = useState("chats");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showProjectMenu, setShowProjectMenu] = useState(null);

  const [isLoading, setIsLoading] = useState({
    threads: false,
    projects: false,
    error: null
  });

  const getAllThreads = async () => {
    if (isLoading.threads) return;
    
    setIsLoading(prev => ({ ...prev, threads: true, error: null }));
    
    try {
      const response = await fetch("http://localhost:8080/api/thread");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const res = await response.json();
      
      // Safely handle projects data
      const threadsInProjects = new Set();
      if (Array.isArray(projects)) {
        projects.forEach((project) => {
          if (project?.chats?.length) {
            project.chats.forEach((chat) => {
              if (chat?.threadId) threadsInProjects.add(chat.threadId);
            });
          }
        });
      }

      const filteredData = Array.isArray(res) 
        ? res
            .filter(thread => thread?.threadId) // Ensure thread has an ID
            .map((thread) => ({
              threadId: thread.threadId, 
              title: thread.title || 'Untitled Chat'
            }))
            .filter((thread) => !threadsInProjects.has(thread.threadId))
        : [];

      // Dedupe by threadId
      const seen = new Set();
      const unique = [];
      for (const t of filteredData) {
        if (t?.threadId && !seen.has(t.threadId)) {
          seen.add(t.threadId);
          unique.push(t);
        }
      }

      setAllThreads(unique);
    } catch (err) {
      console.error("Error fetching threads:", err);
      setAllThreads([]); // Reset to empty array on error
      setIsLoading(prev => ({ ...prev, error: 'Failed to load threads' }));
    } finally {
      setIsLoading(prev => ({ ...prev, threads: false }));
    }
  };

  const getAllProjects = async () => {
    if (isLoading.projects) return;
    
    setIsLoading(prev => ({ ...prev, projects: true, error: null }));
    
    try {
      const response = await fetch("http://localhost:8080/api/projects");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching projects:", err);
      setProjects([]); // Reset to empty array on error
      setIsLoading(prev => ({ ...prev, error: 'Failed to load projects' }));
    } finally {
      setIsLoading(prev => ({ ...prev, projects: false }));
    }
  };

  // Add error boundary state
  const [hasError, setHasError] = useState(false);

  // Error boundary effect
  useEffect(() => {
    const errorHandler = (error) => {
      console.error('Error in Sidebar component:', error);
      setHasError(true);
    };

    // Add error event listener
    window.addEventListener('error', errorHandler);
    
    // Initialize data
    const initData = async () => {
      try {
        await Promise.all([getAllThreads(), getAllProjects()]);
      } catch (error) {
        console.error('Error initializing data:', error);
        setHasError(true);
      }
    };
    
    initData();

    // Cleanup
    return () => {
      window.removeEventListener('error', errorHandler);
    };
  }, []); // Empty dependency array to run only on mount

  // Update threads when current thread or projects change
  useEffect(() => {
    if (!isLoading.threads) {
      getAllThreads();
    }
  }, [currThreadId, projects]);

  // Show error state if something went wrong
  if (hasError) {
    return (
      <div className="sidebar error-state">
        <div className="error-message">
          <h3>Something went wrong</h3>
          <p>Please refresh the page or try again later.</p>
          <button 
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const createNewChat = (projectId = null) => {
    const newThreadId = uuidv1();
    setNewChat(true);
    setPrompt("");
    setReply(null);
    setCurrThreadId(newThreadId);
    setPrevChats([]);

    if (projectId) {
      setCurrentProject(projectId);
    } else {
      setCurrentProject(null);
    }
  };

  const changeThread = async (newThreadId) => {
    setCurrThreadId(newThreadId);

    try {
      const response = await fetch(
        `http://localhost:8080/api/thread/${newThreadId}`
      );
      const res = await response.json();
      console.log(res);
      setPrevChats(res);
      setNewChat(false);
      setReply(null);
    } catch (err) {
      console.log(err);
    }
  };

  const confirmDelete = (threadId, type = "chat", projectId = null) => {
    setDeleteTarget({ id: threadId, type, projectId });
    setShowDeleteConfirm(true);
  };

  const deleteThread = async (threadId) => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/thread/${threadId}`,
        { method: "DELETE" }
      );
      const res = await response.json();
      console.log(res);

      setAllThreads((prev) =>
        prev.filter((thread) => thread.threadId !== threadId)
      );

      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          chats: project.chats.filter((chat) => chat.threadId !== threadId),
        }))
      );

      if (threadId === currThreadId) {
        createNewChat();
      }
    } catch (err) {
      console.log(err);
    }

    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const createProject = async (name) => {
    const newProject = {
      id: uuidv1(),
      name: name || "Untitled Project",
      chats: [],
      createdAt: new Date().toISOString(),
    };
    try {
      await fetch("http://localhost:8080/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newProject.id, name: newProject.name }),
      });
      setProjects((prev) => [...prev, newProject]);
    } catch (err) {
      console.log(err);
    }
    setShowCreateProject(false);

    // Automatically expand the new project and create a new chat
    setExpandedProjects((prev) => new Set([...prev, newProject.id]));
    setActiveSection("projects");
    createNewChat(newProject.id);

    return newProject.id;
  };

  const renameProject = async (projectId, newName) => {
    try {
      await fetch(`http://localhost:8080/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId ? { ...project, name: newName } : project
        )
      );
    } catch (err) {
      console.log(err);
    }
  };

  const deleteProject = async (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    if (project && project.chats.length > 0) {
      const orphanedChats = project.chats.map((chat) => ({
        ...chat,
        projectId: null,
      }));
      setAllThreads((prev) => [...prev, ...orphanedChats]);
    }
    try {
      await fetch(`http://localhost:8080/api/projects/${projectId}`, {
        method: "DELETE",
      });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.log(err);
    }
    if (currentProject === projectId) {
      setCurrentProject(null);
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const toggleProjectExpansion = (projectId) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const moveToProject = async (threadId, projectId) => {
    const thread = allThreads.find((t) => t.threadId === threadId);
    let foundThread = thread;

    // If not in main threads, search in projects
    if (!foundThread) {
      projects.forEach((project) => {
        const chat = project.chats.find((c) => c.threadId === threadId);
        if (chat) foundThread = chat;
      });
    }

    if (!foundThread) return;

    // Remove from all locations
    setAllThreads((prev) => prev.filter((t) => t.threadId !== threadId));
    setProjects((prev) =>
      prev.map((project) => ({
        ...project,
        chats: project.chats.filter((chat) => chat.threadId !== threadId),
      }))
    );

    // Sync backend removal from any previous project
    const prevProject = projects.find((p) => p.chats.some((c) => c.threadId === threadId));
    if (prevProject) {
      try {
        await fetch(`http://localhost:8080/api/projects/${prevProject.id}/chats/${threadId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.log(err);
      }
    }

    // Add to new location
    if (projectId) {
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? {
                ...project,
                chats: [...project.chats, { ...foundThread, projectId }],
              }
            : project
        )
      );
      // Sync backend add
      try {
        await fetch(`http://localhost:8080/api/projects/${projectId}/chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: foundThread.threadId, title: foundThread.title }),
        });
      } catch (err) {
        console.log(err);
      }
    } else {
      setAllThreads((prev) => [...prev, { ...foundThread, projectId: null }]);
    }

    setShowMoveMenu(false);
    setMoveTarget(null);
  };

  const renameChat = async (threadId, newTitle) => {
    // Update UI immediately
    setAllThreads((prev) =>
      prev.map((thread) =>
        thread.threadId === threadId ? { ...thread, title: newTitle } : thread
      )
    );
    setProjects((prev) =>
      prev.map((project) => ({
        ...project,
        chats: project.chats.map((chat) =>
          chat.threadId === threadId ? { ...chat, title: newTitle } : chat
        ),
      }))
    );

    // Persist to thread collection
    try {
      await fetch(`http://localhost:8080/api/thread/${threadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
    } catch (err) {
      console.log(err);
    }

    // If chat exists inside a project, persist there too
    const projectWithChat = projects.find((p) => p.chats.some((c) => c.threadId === threadId));
    if (projectWithChat) {
      try {
        await fetch(`http://localhost:8080/api/projects/${projectWithChat.id}/chats/${threadId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
      } catch (err) {
        console.log(err);
      }
    }
  };

  const toggleDropdown = (threadId) => {
    setActiveDropdown(activeDropdown === threadId ? null : threadId);
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
  };

  const toggleProjectMenu = (projectId) => {
    setShowProjectMenu(showProjectMenu === projectId ? null : projectId);
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (activeDropdown) {
        closeDropdown();
      }
      if (showProjectMenu) {
        setShowProjectMenu(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [activeDropdown, showProjectMenu]);

  return (
    <section className="sidebar">
      {/* Header */}
      <div className="sidebarHeader">
        <button className="newChatBtn" onClick={() => createNewChat()}>
          <i className="fa-solid fa-plus"></i>
          <span>New chat</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="navTabs">
        <div
          className={`navTab ${activeSection === "chats" ? "active" : ""}`}
          onClick={() => setActiveSection("chats")}
        >
          <i className="fa-solid fa-comment"></i>
          <span>Chats</span>
        </div>
        <div
          className={`navTab ${activeSection === "projects" ? "active" : ""}`}
          onClick={() => setActiveSection("projects")}
        >
          <i className="fa-solid fa-folder"></i>
          <span>Projects</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="chatHistory">
        {activeSection === "chats" ? (
          <div className="historySection">
            <div className="sectionHeader">
              <h3 className="sectionTitle">Recent Chats</h3>
            </div>
            <ul className="threadList">
              {allThreads?.map((thread) => (
                <li
                  key={thread.threadId}
                  className={`threadItem ${
                    thread.threadId === currThreadId ? "active" : ""
                  }`}
                  onClick={(e) => changeThread(thread.threadId)}
                >
                  <div className="threadContent">
                    <span className="threadTitle">{thread.title}</span>
                  </div>
                  <div className="threadActions">
                    <div
                      className="threeDots"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(thread.threadId);
                      }}
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>

                      {activeDropdown === thread.threadId && (
                        <div
                          className="dropdownMenu"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className="menuItem"
                            onClick={() => {
                              setRenameTarget({
                                type: "chat",
                                id: thread.threadId,
                                currentName: thread.title,
                              });
                              setShowRenameModal(true);
                              closeDropdown();
                            }}
                          >
                            <i className="fa-solid fa-edit"></i>
                            <span>Rename</span>
                          </div>
                          <div
                            className="menuItem"
                            onClick={() => {
                              setMoveTarget(thread.threadId);
                              setShowMoveMenu(true);
                              closeDropdown();
                            }}
                          >
                            <i className="fa-solid fa-folder-plus"></i>
                            <span>Move to Project</span>
                          </div>
                          <div
                            className="menuItem delete"
                            onClick={() => {
                              confirmDelete(thread.threadId);
                              closeDropdown();
                            }}
                          >
                            <i className="fa-solid fa-trash"></i>
                            <span>Delete</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="historySection">
            <div className="sectionHeader">
              <h3 className="sectionTitle">Projects</h3>
              <button
                className="createProjectBtn"
                onClick={() => setShowCreateProject(true)}
                title="Create new project"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            </div>

            {/* Projects List */}
            <div className="projectsList">
              {projects.map((project) => (
                <div key={project.id} className="projectItem">
                  <div className="projectHeader">
                    <div
                      className="projectInfo"
                      onClick={() => toggleProjectExpansion(project.id)}
                    >
                      <i
                        className={`fa-solid ${
                          expandedProjects.has(project.id)
                            ? "fa-chevron-down"
                            : "fa-chevron-right"
                        } expandIcon`}
                      ></i>
                      <i className="fa-solid fa-folder projectIcon"></i>
                      <span className="projectName">{project.name}</span>
                      <span className="chatCount">
                        ({project.chats.length})
                      </span>
                    </div>
                    <div className="projectActions">
                      <div
                        className="threeDots"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProjectMenu(project.id);
                        }}
                      >
                        <i className="fa-solid fa-ellipsis-vertical"></i>

                        {showProjectMenu === project.id && (
                          <div
                            className="dropdownMenu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              className="menuItem"
                              onClick={() => {
                                createNewChat(project.id);
                                setShowProjectMenu(null);
                              }}
                            >
                              <i className="fa-solid fa-plus"></i>
                              <span>New Chat</span>
                            </div>
                            <div
                              className="menuItem"
                              onClick={() => {
                                setRenameTarget({
                                  type: "project",
                                  id: project.id,
                                  currentName: project.name,
                                });
                                setShowRenameModal(true);
                                setShowProjectMenu(null);
                              }}
                            >
                              <i className="fa-solid fa-edit"></i>
                              <span>Rename Project</span>
                            </div>
                            <div
                              className="menuItem delete"
                              onClick={() => {
                                confirmDelete(project.id, "project");
                                setShowProjectMenu(null);
                              }}
                            >
                              <i className="fa-solid fa-trash"></i>
                              <span>Delete Project</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedProjects.has(project.id) && (
                    <ul className="projectChats">
                      {project.chats.map((chat) => (
                        <li
                          key={chat.threadId}
                          className={`threadItem ${
                            chat.threadId === currThreadId ? "active" : ""
                          }`}
                          onClick={() => changeThread(chat.threadId)}
                        >
                          <div className="threadContent">
                            <span className="threadTitle">{chat.title}</span>
                          </div>
                          <div className="threadActions">
                            <div
                              className="threeDots"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDropdown(chat.threadId);
                              }}
                            >
                              <i className="fa-solid fa-ellipsis-vertical"></i>

                              {activeDropdown === chat.threadId && (
                                <div
                                  className="dropdownMenu"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div
                                    className="menuItem"
                                    onClick={() => {
                                      setRenameTarget({
                                        type: "chat",
                                        id: chat.threadId,
                                        currentName: chat.title,
                                      });
                                      setShowRenameModal(true);
                                      closeDropdown();
                                    }}
                                  >
                                    <i className="fa-solid fa-edit"></i>
                                    <span>Rename</span>
                                  </div>
                                  <div
                                    className="menuItem"
                                    onClick={() => {
                                      moveToProject(chat.threadId, null);
                                      closeDropdown();
                                    }}
                                  >
                                    <i className="fa-solid fa-arrow-up"></i>
                                    <span>Move to Main</span>
                                  </div>
                                  <div
                                    className="menuItem"
                                    onClick={() => {
                                      setMoveTarget(chat.threadId);
                                      setShowMoveMenu(true);
                                      closeDropdown();
                                    }}
                                  >
                                    <i className="fa-solid fa-folder"></i>
                                    <span>Move to Other Project</span>
                                  </div>
                                  <div
                                    className="menuItem delete"
                                    onClick={() => {
                                      confirmDelete(
                                        chat.threadId,
                                        "chat",
                                        project.id
                                      );
                                      closeDropdown();
                                    }}
                                  >
                                    <i className="fa-solid fa-trash"></i>
                                    <span>Delete</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sidebarFooter">
        <div className="footerInfo">
          <p>Made with ❤️ by Gaurav Jain</p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="modal">
          <div className="modalContent">
            <h3>Confirm Delete</h3>
            <p>
              {deleteTarget.type === "project"
                ? "Are you sure you want to delete this project? All chats will be moved to Recent Chats."
                : "Are you sure you want to delete this chat? This action cannot be undone."}
            </p>
            <div className="modalActions">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                className="deleteBtn"
                onClick={() => {
                  if (deleteTarget.type === "project") {
                    deleteProject(deleteTarget.id);
                  } else {
                    deleteThread(deleteTarget.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="modal">
          <div className="modalContent">
            <h3>Create New Project</h3>
            <input
              type="text"
              placeholder="Project name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  createProject(e.target.value);
                }
                if (e.key === "Escape") {
                  setShowCreateProject(false);
                }
              }}
            />
            <div className="modalActions">
              <button onClick={() => setShowCreateProject(false)}>
                Cancel
              </button>
              <button
                onClick={(e) => {
                  const input = e.target.parentElement.previousElementSibling;
                  createProject(input.value);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && renameTarget && (
        <div className="modal">
          <div className="modalContent">
            <h3>
              Rename {renameTarget.type === "project" ? "Project" : "Chat"}
            </h3>
            <input
              type="text"
              defaultValue={renameTarget.currentName}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (renameTarget.type === "project") {
                    renameProject(renameTarget.id, e.target.value);
                  } else {
                    renameChat(renameTarget.id, e.target.value);
                  }
                  setShowRenameModal(false);
                  setRenameTarget(null);
                }
                if (e.key === "Escape") {
                  setShowRenameModal(false);
                  setRenameTarget(null);
                }
              }}
            />
            <div className="modalActions">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  const input = e.target.parentElement.previousElementSibling;
                  if (renameTarget.type === "project") {
                    renameProject(renameTarget.id, input.value);
                  } else {
                    renameChat(renameTarget.id, input.value);
                  }
                  setShowRenameModal(false);
                  setRenameTarget(null);
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Project Menu */}
      {showMoveMenu && moveTarget && (
        <div className="modal">
          <div className="modalContent">
            <h3>Move to Project</h3>
            <div className="projectOptions">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="projectOption"
                  onClick={() => {
                    moveToProject(moveTarget, project.id);
                  }}
                >
                  <i className="fa-solid fa-folder"></i>
                  <span>{project.name}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setShowMoveMenu(false);
                setMoveTarget(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default Sidebar;
