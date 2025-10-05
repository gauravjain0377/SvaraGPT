import "./Sidebar.css";
import { useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import {v1 as uuidv1} from "uuid";

function Sidebar() {
    const {
        allThreads, setAllThreads, currThreadId, setNewChat, setPrompt, setReply, setCurrThreadId, setPrevChats,
        projects, setProjects, currentProject, setCurrentProject, selectedProject, setSelectedProject,
        showCreateProject, setShowCreateProject, showRenameModal, setShowRenameModal, renameTarget, setRenameTarget,
        expandedProjects, setExpandedProjects, showMoveMenu, setShowMoveMenu, moveTarget, setMoveTarget,
        activeDropdown, setActiveDropdown
    } = useContext(MyContext);
    
    const [activeSection, setActiveSection] = useState('chats'); // 'chats' or 'projects'

    const getAllThreads = async () => {
        try {
            const response = await fetch("http://localhost:8080/api/thread");
            const res = await response.json();
            const filteredData = res.map(thread => ({threadId: thread.threadId, title: thread.title}));
            //console.log(filteredData);
            setAllThreads(filteredData);
        } catch(err) {
            console.log(err);
        }
    };

    useEffect(() => {
        getAllThreads();
    }, [currThreadId])


    const createNewChat = () => {
        const newThreadId = uuidv1();
        setNewChat(true);
        setPrompt("");
        setReply(null);
        setCurrThreadId(newThreadId);
        setPrevChats([]);
        
        // If we're in a project context and have a selected project, set current project
        if (activeSection === 'projects' && selectedProject) {
            setCurrentProject(selectedProject);
        } else {
            setCurrentProject(null);
        }
    };

    const changeThread = async (newThreadId) => {
        setCurrThreadId(newThreadId);

        try {
            const response = await fetch(`http://localhost:8080/api/thread/${newThreadId}`);
            const res = await response.json();
            console.log(res);
            setPrevChats(res);
            setNewChat(false);
            setReply(null);
        } catch(err) {
            console.log(err);
        }
    }   

    const deleteThread = async (threadId) => {
        try {
            const response = await fetch(`http://localhost:8080/api/thread/${threadId}`, {method: "DELETE"});
            const res = await response.json();
            console.log(res);

            //updated threads re-render
            setAllThreads(prev => prev.filter(thread => thread.threadId !== threadId));
            
            // Also remove from projects if exists
            setProjects(prev => prev.map(project => ({
                ...project,
                chats: project.chats.filter(chat => chat.threadId !== threadId)
            })));

            if(threadId === currThreadId) {
                createNewChat();
            }

        } catch(err) {
            console.log(err);
        }
    }
    
    // Project Management Functions
    const createProject = (name) => {
        const newProject = {
            id: uuidv1(),
            name: name || 'Untitled Project',
            chats: [],
            createdAt: new Date().toISOString()
        };
        setProjects(prev => [...prev, newProject]);
        setShowCreateProject(false);
        return newProject.id;
    };
    
    const renameProject = (projectId, newName) => {
        setProjects(prev => prev.map(project => 
            project.id === projectId ? {...project, name: newName} : project
        ));
    };
    
    const deleteProject = (projectId) => {
        const project = projects.find(p => p.id === projectId);
        if (project && project.chats.length > 0) {
            // Move chats back to main thread list
            const orphanedChats = project.chats.map(chat => ({...chat, projectId: null}));
            setAllThreads(prev => [...prev, ...orphanedChats]);
        }
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (currentProject === projectId) {
            setCurrentProject(null);
        }
    };
    
    const toggleProjectExpansion = (projectId) => {
        setExpandedProjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    };
    
    const moveToProject = (threadId, projectId) => {
        const thread = allThreads.find(t => t.threadId === threadId);
        if (!thread) return;
        
        // Remove from current location
        setAllThreads(prev => prev.filter(t => t.threadId !== threadId));
        setProjects(prev => prev.map(project => ({
            ...project,
            chats: project.chats.filter(chat => chat.threadId !== threadId)
        })));
        
        if (projectId) {
            // Add to project
            setProjects(prev => prev.map(project => 
                project.id === projectId 
                    ? {...project, chats: [...project.chats, {...thread, projectId}]}
                    : project
            ));
        } else {
            // Move to main threads
            setAllThreads(prev => [...prev, {...thread, projectId: null}]);
        }
    };
    
    const renameChat = (threadId, newTitle) => {
        // Update in main threads
        setAllThreads(prev => prev.map(thread => 
            thread.threadId === threadId ? {...thread, title: newTitle} : thread
        ));
        // Update in projects
        setProjects(prev => prev.map(project => ({
            ...project,
            chats: project.chats.map(chat => 
                chat.threadId === threadId ? {...chat, title: newTitle} : chat
            )
        })));
    };
    
    // Three dots menu handlers
    const toggleDropdown = (threadId) => {
        setActiveDropdown(activeDropdown === threadId ? null : threadId);
    };
    
    const closeDropdown = () => {
        setActiveDropdown(null);
    };
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            if (activeDropdown) {
                closeDropdown();
            }
        };
        
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [activeDropdown]);

    return (
        <section className="sidebar">
            {/* Header */}
            <div className="sidebarHeader">
                {activeSection === 'projects' && projects.length > 0 ? (
                    <div className="newChatWithProject">
                        <select 
                            className="projectSelector" 
                            value={selectedProject || ''} 
                            onChange={(e) => setSelectedProject(e.target.value || null)}
                        >
                            <option value="">Select Project</option>
                            {projects.map(project => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                        </select>
                        <button className="newChatBtn" onClick={createNewChat}>
                            <i className="fa-solid fa-plus"></i>
                            <span>New chat</span>
                        </button>
                    </div>
                ) : (
                    <button className="newChatBtn" onClick={createNewChat}>
                        <i className="fa-solid fa-plus"></i>
                        <span>New chat</span>
                    </button>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="navTabs">
                <div className={`navTab ${activeSection === 'chats' ? 'active' : ''}`} onClick={() => setActiveSection('chats')}>
                    <i className="fa-solid fa-comment"></i>
                    <span>Chats</span>
                </div>
                <div className={`navTab ${activeSection === 'projects' ? 'active' : ''}`} onClick={() => setActiveSection('projects')}>
                    <i className="fa-solid fa-folder"></i>
                    <span>Projects</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="chatHistory">
                {activeSection === 'chats' ? (
                    <div className="historySection">
                        <div className="sectionHeader">
                            <h3 className="sectionTitle">Recent Chats</h3>
                        </div>
                        <ul className="threadList">
                            {
                                allThreads?.map((thread, idx) => (
                                    <li key={idx} 
                                        className={`threadItem ${thread.threadId === currThreadId ? "active" : ""}`}
                                        onClick={(e) => changeThread(thread.threadId)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setMoveTarget(thread.threadId);
                                            setShowMoveMenu(true);
                                        }}
                                    >
                                        <div className="threadContent">
                                            <span className="threadTitle">{thread.title}</span>
                                        </div>
                                        <div className="threadActions">
                                            <div className="threeDots" onClick={(e) => {
                                                e.stopPropagation();
                                                toggleDropdown(thread.threadId);
                                            }}>
                                                <i className="fa-solid fa-ellipsis-vertical"></i>
                                                
                                                {activeDropdown === thread.threadId && (
                                                    <div className="dropdownMenu" onClick={(e) => e.stopPropagation()}>
                                                        <div className="menuItem" onClick={() => {
                                                            setRenameTarget({type: 'chat', id: thread.threadId, currentName: thread.title});
                                                            setShowRenameModal(true);
                                                            closeDropdown();
                                                        }}>
                                                            <i className="fa-solid fa-edit"></i>
                                                            <span>Rename</span>
                                                        </div>
                                                        <div className="menuItem" onClick={() => {
                                                            setMoveTarget(thread.threadId);
                                                            setShowMoveMenu(true);
                                                            closeDropdown();
                                                        }}>
                                                            <i className="fa-solid fa-folder-plus"></i>
                                                            <span>Move to Project</span>
                                                        </div>
                                                        <div className="menuItem delete" onClick={() => {
                                                            deleteThread(thread.threadId);
                                                            closeDropdown();
                                                        }}>
                                                            <i className="fa-solid fa-trash"></i>
                                                            <span>Delete</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))
                            }
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
                                    <div className="projectHeader" onClick={() => toggleProjectExpansion(project.id)}>
                                        <div className="projectInfo">
                                            <i className={`fa-solid ${expandedProjects.has(project.id) ? 'fa-chevron-down' : 'fa-chevron-right'} expandIcon`}></i>
                                            <i className="fa-solid fa-folder projectIcon"></i>
                                            <span className="projectName">{project.name}</span>
                                            <span className="chatCount">({project.chats.length})</span>
                                        </div>
                                        <div className="projectActions">
                                            <button 
                                                className="actionBtn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setRenameTarget({type: 'project', id: project.id, currentName: project.name});
                                                    setShowRenameModal(true);
                                                }}
                                                title="Rename project"
                                            >
                                                <i className="fa-solid fa-edit"></i>
                                            </button>
                                            <button 
                                                className="deleteBtn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteProject(project.id);
                                                }}
                                                title="Delete project"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {expandedProjects.has(project.id) && (
                                        <ul className="projectChats">
                                            {project.chats.map((chat) => (
                                                <li key={chat.threadId} 
                                                    className={`threadItem ${chat.threadId === currThreadId ? "active" : ""}`}
                                                    onClick={() => changeThread(chat.threadId)}
                                                >
                                                    <div className="threadContent">
                                                        <span className="threadTitle">{chat.title}</span>
                                                    </div>
                                                    <div className="threadActions">
                                                        <div className="threeDots" onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleDropdown(chat.threadId);
                                                        }}>
                                                            <i className="fa-solid fa-ellipsis-vertical"></i>
                                                            
                                                            {activeDropdown === chat.threadId && (
                                                                <div className="dropdownMenu" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="menuItem" onClick={() => {
                                                                        setRenameTarget({type: 'chat', id: chat.threadId, currentName: chat.title});
                                                                        setShowRenameModal(true);
                                                                        closeDropdown();
                                                                    }}>
                                                                        <i className="fa-solid fa-edit"></i>
                                                                        <span>Rename</span>
                                                                    </div>
                                                                    <div className="menuItem" onClick={() => {
                                                                        moveToProject(chat.threadId, null);
                                                                        closeDropdown();
                                                                    }}>
                                                                        <i className="fa-solid fa-arrow-up"></i>
                                                                        <span>Move to Main</span>
                                                                    </div>
                                                                    <div className="menuItem" onClick={() => {
                                                                        setMoveTarget(chat.threadId);
                                                                        setShowMoveMenu(true);
                                                                        closeDropdown();
                                                                    }}>
                                                                        <i className="fa-solid fa-folder"></i>
                                                                        <span>Move to Other Project</span>
                                                                    </div>
                                                                    <div className="menuItem delete" onClick={() => {
                                                                        deleteThread(chat.threadId);
                                                                        closeDropdown();
                                                                    }}>
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
                                if (e.key === 'Enter') {
                                    createProject(e.target.value);
                                }
                                if (e.key === 'Escape') {
                                    setShowCreateProject(false);
                                }
                            }}
                        />
                        <div className="modalActions">
                            <button onClick={() => setShowCreateProject(false)}>Cancel</button>
                            <button onClick={(e) => {
                                const input = e.target.parentElement.previousElementSibling;
                                createProject(input.value);
                            }}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Modal */}
            {showRenameModal && renameTarget && (
                <div className="modal">
                    <div className="modalContent">
                        <h3>Rename {renameTarget.type === 'project' ? 'Project' : 'Chat'}</h3>
                        <input 
                            type="text" 
                            defaultValue={renameTarget.currentName}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (renameTarget.type === 'project') {
                                        renameProject(renameTarget.id, e.target.value);
                                    } else {
                                        renameChat(renameTarget.id, e.target.value);
                                    }
                                    setShowRenameModal(false);
                                    setRenameTarget(null);
                                }
                                if (e.key === 'Escape') {
                                    setShowRenameModal(false);
                                    setRenameTarget(null);
                                }
                            }}
                        />
                        <div className="modalActions">
                            <button onClick={() => {
                                setShowRenameModal(false);
                                setRenameTarget(null);
                            }}>Cancel</button>
                            <button onClick={(e) => {
                                const input = e.target.parentElement.previousElementSibling;
                                if (renameTarget.type === 'project') {
                                    renameProject(renameTarget.id, input.value);
                                } else {
                                    renameChat(renameTarget.id, input.value);
                                }
                                setShowRenameModal(false);
                                setRenameTarget(null);
                            }}>Rename</button>
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
                            {projects.map(project => (
                                <div key={project.id} 
                                    className="projectOption" 
                                    onClick={() => {
                                        moveToProject(moveTarget, project.id);
                                        setShowMoveMenu(false);
                                        setMoveTarget(null);
                                    }}
                                >
                                    <i className="fa-solid fa-folder"></i>
                                    <span>{project.name}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => {
                            setShowMoveMenu(false);
                            setMoveTarget(null);
                        }}>Cancel</button>
                    </div>
                </div>
            )}
        </section>
    )
}

export default Sidebar;