import React, { useState, useEffect } from "react";
import {
  Button,
  Tag,
  Space,
  Form,
  Input,
  Select,
  Popconfirm,
  Typography,
  message,
  Spin,
  Tooltip,
  Drawer,
  Progress,
  Avatar,
  Radio,
  Modal,
} from "antd";
import {
  PlusOutlined,
  BranchesOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltFilled,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleFilled,
  ReloadOutlined,
  LinkOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  ExportOutlined,
  BookOutlined,
  AuditOutlined,
  RocketFilled,
  UserOutlined,
  HistoryOutlined,
  CloseOutlined,
  SafetyOutlined,
  SwapOutlined,
  GithubOutlined,
  LockOutlined,
  CheckCircleTwoTone,
  LogoutOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { GitRepositoryConfig } from "../../../types/platform";
import {
  fetchGitRepositoriesApi,
  saveGitRepositoryApi,
  deleteGitRepositoryApi,
  syncGitRepositoryApi,
  fetchRemoteBranchesApi,
  fetchUserRepositoriesApi,
  verifyGitTokenApi,
  GitUserProfile,
  RemoteUserRepoItem,
} from "../../../services/api";

const { Text } = Typography;

// 历史保存真实账号数据模型（纯净真实，零假数据）
interface SavedGitAccount {
  id: string;
  type: "token" | "ssh" | "none";
  name: string;
  login?: string;
  avatarUrl?: string;
  token?: string;
  sshKey?: string;
  lastUsed: number;
}

const STORAGE_KEY = "ownagent_git_saved_accounts";

// 获取历史真实保存的账号（自动清理旧版本假数据）
const getSavedAccounts = (): SavedGitAccount[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: SavedGitAccount[] = JSON.parse(raw);
    return list.filter(
      (a) =>
        !a.id.includes("preset") &&
        !a.name.includes("魔术师") &&
        !a.name.includes("腾讯云") &&
        !a.name.includes("17301@")
    );
  } catch {
    return [];
  }
};

const saveAccountToHistory = (account: SavedGitAccount) => {
  try {
    const existing = getSavedAccounts();
    const filtered = existing.filter(
      (a) => a.id !== account.id && (account.token ? a.token !== account.token : true)
    );
    const updated = [account, ...filtered].slice(0, 5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
};

const removeAccountFromHistory = (id: string) => {
  try {
    const existing = getSavedAccounts();
    const updated = existing.filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
};

interface Step1RepositoriesProps {
  workflowId?: string;
  gitRepos: GitRepositoryConfig[];
  setGitRepos: React.Dispatch<React.SetStateAction<GitRepositoryConfig[]>>;
  onNextStep?: () => void;
}

// 统一标准化的 Git 仓库 URL 归一器（忽略协议差异、大小写、末尾斜杠与 .git 后缀）
export const normalizeGitRepoUrl = (url?: string): string => {
  if (!url) return "";
  let clean = url.trim().toLowerCase();
  clean = clean.replace(/\/+$/, "");
  clean = clean.replace(/\.git$/, "");
  clean = clean.replace(/^git@([^:]+):/, "$1/");
  clean = clean.replace(/^https?:\/\//, "");
  return clean;
};

export const Step1Repositories: React.FC<Step1RepositoriesProps> = ({
  workflowId,
  gitRepos,
  setGitRepos,
  onNextStep,
}) => {
  // 视图模式：默认进入代码仓库资产大厅 ("list")，点击绑定新仓库或修改配置才进入向导 ("editor")
  const [viewMode, setViewMode] = useState<"editor" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [editingRepo, setEditingRepo] = useState<GitRepositoryConfig | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // ══════════════════════════════════════════════════════════════════
  // 阶段推进：第 1 步【只有登录】，登录成功后【再让选择分支与仓库出来】
  // stage: "login" (登录认证) -> "configure" (选择分支与仓库)
  // ══════════════════════════════════════════════════════════════════
  const [stage, setStage] = useState<"login" | "configure">("login");

  // 真实已保存的账号列表（无假数据）
  const [savedAccounts, setSavedAccounts] = useState<SavedGitAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  // 真实登录后的用户信息（通过后端直接请求 GitHub 官方 API 返回真实资料）
  const [userProfile, setUserProfile] = useState<GitUserProfile | null>(null);

  // 1. 登录认证方式：单选（"token" | "ssh" | "none"）
  const [authType, setAuthType] = useState<"token" | "ssh" | "none">("token");
  const [authenticating, setAuthenticating] = useState(false);

  // SSH 模式细分：直接粘贴私钥内容 vs 选用服务器本机默认密钥
  const [sshInputMode, setSshInputMode] = useState<"custom" | "server">("custom");
  const [customSshKey, setCustomSshKey] = useState("");

  // 2. 仓库获取模式：Token 直读名下仓库 vs 手动输入 URL
  const [repoInputMode, setRepoInputMode] = useState<"select" | "manual">("select");
  const [userRepoList, setUserRepoList] = useState<RemoteUserRepoItem[]>([]);
  const [fetchingUserRepos, setFetchingUserRepos] = useState(false);

  // 3. 远端分支池与当前选中
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>(["main"]);
  const [defaultBranchName, setDefaultBranchName] = useState<string>("main");
  const [fetchingBranches, setFetchingBranches] = useState(false);

  // 4. 实时状态（供右侧小记录框即时跟踪）
  const [currentRepoUrl, setCurrentRepoUrl] = useState("");
  const [currentRepoName, setCurrentRepoName] = useState("");
  const [currentToken, setCurrentToken] = useState("");

  // 5. 提交状态与指引抽屉
  const [editorSubmitting, setEditorSubmitting] = useState(false);
  const [guidanceDrawerOpen, setGuidanceDrawerOpen] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState<"github" | "gitlab" | "gitee" | "coding">("github");

  const [form] = Form.useForm();

  // 加载持久化仓库与真实历史账号
  const loadInitialData = async () => {
    setSavedAccounts(getSavedAccounts());
    setLoadingList(true);
    try {
      const data = await fetchGitRepositoriesApi(workflowId);
      setGitRepos(data);
    } catch (err) {
      console.error("加载代码库失败", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [workflowId]);

  // 从 URL 提取项目名称
  const autoExtractRepoName = (url: string) => {
    if (!url) return "";
    try {
      let clean = url.trim().replace(/\.git$/, "");
      const slashIdx = clean.lastIndexOf("/");
      const colonIdx = clean.lastIndexOf(":");
      const cutIdx = Math.max(slashIdx, colonIdx);
      if (cutIdx > 0 && cutIdx < clean.length - 1) {
        return clean.substring(cutIdx + 1);
      }
    } catch {}
    return "";
  };

  // ══════════════════════════════════════════════════════════════════
  // 每次进入时【彻底初始化】状态，清除一切残留，绝不留假数据
  // ══════════════════════════════════════════════════════════════════
  const resetAndInitializeWorkbench = () => {
    setEditingRepo(null);
    setStage("login");
    setAuthType("token");
    setRepoInputMode("select");
    setUserRepoList([]);
    setRemoteBranches([]);
    setSelectedBranches(["main"]);
    setDefaultBranchName("main");
    setCurrentRepoUrl("");
    setCurrentRepoName("");
    setCurrentToken("");
    setUserProfile(null);
    setCustomSshKey("");
    setSshInputMode("custom");
    setActiveAccountId(null);
    form.resetFields();
    form.setFieldsValue({
      authType: "token",
      accessToken: "",
      sshKey: "",
      repoUrl: "",
      name: "",
    });
    setSavedAccounts(getSavedAccounts());
  };

  // 打开新增代码库：若历史账号池已有已验证 Token，自动沿用凭据直达第 2 步，免除反复登录
  const handleOpenAdd = () => {
    const accounts = getSavedAccounts();
    setSavedAccounts(accounts);
    setEditingRepo(null);
    setCurrentRepoUrl("");
    setCurrentRepoName("");
    setRemoteBranches([]);
    setSelectedBranches(["main"]);
    setDefaultBranchName("main");
    form.resetFields();

    const activeTokenAcc = accounts.find((a) => a.type === "token" && a.token);
    if (activeTokenAcc && activeTokenAcc.token) {
      setActiveAccountId(activeTokenAcc.id);
      setAuthType("token");
      setCurrentToken(activeTokenAcc.token);
      if (activeTokenAcc.login) {
        setUserProfile({
          ok: true,
          login: activeTokenAcc.login,
          name: activeTokenAcc.name,
          avatarUrl: activeTokenAcc.avatarUrl,
        });
      }
      form.setFieldsValue({
        authType: "token",
        accessToken: activeTokenAcc.token,
      });
      setStage("configure");
      setRepoInputMode("select");
      loadUserRepositories(activeTokenAcc.token);
    } else {
      resetAndInitializeWorkbench();
    }
    setViewMode("editor");
  };

  // 打开编辑已有代码库 (直接进入第二阶段配置)
  const handleOpenEdit = (repo: GitRepositoryConfig) => {
    setEditingRepo(repo);
    setStage("configure");
    const curAuth = (repo.authType as any) || "token";
    setAuthType(curAuth);
    setRepoInputMode("manual");
    setUserRepoList([]);

    const branchArray = repo.branch
      ? repo.branch.split(",").map((s) => s.trim()).filter(Boolean)
      : ["main"];

    setRemoteBranches(branchArray);
    setSelectedBranches(branchArray);
    setDefaultBranchName(branchArray[0] || "main");

    setCurrentRepoUrl(repo.repoUrl);
    setCurrentRepoName(repo.name);
    setCurrentToken(repo.accessToken || "");

    if (repo.sshKey && repo.sshKey.trim() !== "SYSTEM" && repo.sshKey.trim() !== "") {
      setCustomSshKey(repo.sshKey);
      setSshInputMode("custom");
    } else {
      setSshInputMode("server");
    }

    form.setFieldsValue({
      name: repo.name,
      repoUrl: repo.repoUrl,
      authType: curAuth,
      accessToken: repo.accessToken,
      sshKey: repo.sshKey,
    });
    setViewMode("editor");
  };

  // 核心拉取名下仓库的方法（安全可靠，数据持久保存在状态中，保障切步时不丢失）
  const loadUserRepositories = async (tokenToUse?: string): Promise<RemoteUserRepoItem[]> => {
    const token = tokenToUse || currentToken || form.getFieldValue("accessToken");
    if (!token || !token.trim()) return [];
    setFetchingUserRepos(true);
    try {
      const repos = await fetchUserRepositoriesApi({
        accessToken: token.trim(),
        gitHost: guidePlatform,
      });
      if (repos && repos.length > 0) {
        setUserRepoList(repos);
        setRepoInputMode("select");
        return repos;
      } else {
        setUserRepoList([]);
      }
    } catch (err) {
      console.error("加载名下代码仓库失败", err);
    } finally {
      setFetchingUserRepos(false);
    }
    return [];
  };

  // 切到 configure 阶段且已存在 token 时，若名下仓库为空自动尝试恢复拉取
  useEffect(() => {
    if (stage === "configure" && authType === "token" && userRepoList.length === 0) {
      const token = currentToken || form.getFieldValue("accessToken");
      if (token) {
        loadUserRepositories(token);
      }
    }
  }, [stage, authType, currentToken, userRepoList.length]);

  // 一键选用真实历史保存账号
  const handleSelectSavedAccount = (acc: SavedGitAccount) => {
    setActiveAccountId(acc.id);
    setAuthType(acc.type);
    form.setFieldsValue({ authType: acc.type });

    if (acc.type === "token" && acc.token) {
      form.setFieldsValue({ accessToken: acc.token });
      setCurrentToken(acc.token);
      if (acc.login) {
        setUserProfile({
          ok: true,
          login: acc.login,
          name: acc.name,
          avatarUrl: acc.avatarUrl,
        });
      }
      // 预先拉取名下项目，保障无缝切换到第2步直接有数据
      loadUserRepositories(acc.token);
    } else if (acc.type === "ssh") {
      setUserProfile(null);
      if (acc.sshKey && acc.sshKey !== "SYSTEM") {
        setCustomSshKey(acc.sshKey);
        setSshInputMode("custom");
        form.setFieldsValue({ sshKey: acc.sshKey });
      } else {
        setSshInputMode("server");
      }
    } else {
      setUserProfile(null);
    }
    message.success(`已切换账号凭据：${acc.name}`);
  };

  // 删除某条历史账号记录
  const handleDeleteSavedAccount = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeAccountFromHistory(id);
    setSavedAccounts(getSavedAccounts());
    if (activeAccountId === id) {
      setActiveAccountId(null);
    }
    message.info("已移除该历史账号记录");
  };

  // 登出/清空当前登录信息，重新输入
  const handleLogoutCurrentProfile = () => {
    setUserProfile(null);
    setCurrentToken("");
    form.setFieldsValue({ accessToken: "" });
    setActiveAccountId(null);
    setUserRepoList([]);
    setCurrentRepoUrl("");
    setCurrentRepoName("");
    setRemoteBranches([]);
    setSelectedBranches(["main"]);
    message.info("已退出当前登录账号，您可以重新输入令牌或切换其他登录方式");
  };

  // ══════════════════════════════════════════════════════════════════
  // 第一步核心动作：【真实登录并验证】
  // 调用后端真实 API 检验 GitHub/GitLab 官方响应，拿到真实用户资料
  // ══════════════════════════════════════════════════════════════════
  const handleVerifyLoginAndProceed = async () => {
    setAuthenticating(true);

    try {
      if (authType === "token") {
        const token = form.getFieldValue("accessToken") || currentToken;
        if (!token || !token.trim()) {
          message.warning("请在输入框中粘贴访问令牌 (Token)");
          setAuthenticating(false);
          return;
        }

        // 如果已经验证过且有 profile，确保名下仓库就绪后再进入下一步
        if (userProfile && userProfile.ok) {
          if (userRepoList.length === 0) {
            await loadUserRepositories(token.trim());
          }
          setStage("configure");
          return;
        }

        // 调用后端官方接口真实验证 Token
        const verifyRes = await verifyGitTokenApi({
          accessToken: token.trim(),
          gitHost: guidePlatform,
        });

        if (!verifyRes.ok) {
          message.error(verifyRes.error || "Token 验证失败，请确认令牌有效且包含 repo 权限");
          setAuthenticating(false);
          return;
        }

        setUserProfile(verifyRes);
        setCurrentToken(token.trim());

        // 保存真实已登录账号到历史
        const realName = verifyRes.name || verifyRes.login || "GitHub 用户";
        const accountRecord: SavedGitAccount = {
          id: `token-${verifyRes.login || Date.now()}`,
          type: "token",
          name: `${realName} (@${verifyRes.login})`,
          login: verifyRes.login,
          avatarUrl: verifyRes.avatarUrl,
          token: token.trim(),
          lastUsed: Date.now(),
        };
        saveAccountToHistory(accountRecord);
        setSavedAccounts(getSavedAccounts());

        // 自动拉取名下代码仓库列表
        const repos = await loadUserRepositories(token.trim());
        if (repos && repos.length > 0) {
          message.success(`登录成功！欢迎 @${verifyRes.login}，已为您读取到名下 ${repos.length} 个项目`);
        } else {
          setRepoInputMode("manual");
          message.success(`登录成功！欢迎 @${verifyRes.login}，请在下一步输入目标代码库地址`);
        }
      } else if (authType === "ssh") {
        // SSH 模式登录
        if (sshInputMode === "custom") {
          const keyVal = form.getFieldValue("sshKey") || customSshKey;
          if (!keyVal || !keyVal.trim()) {
            message.warning("请在文本框中粘贴您的 SSH 私钥 (Private Key)");
            setAuthenticating(false);
            return;
          }
          if (!keyVal.includes("PRIVATE KEY")) {
            message.warning("私钥格式不规范，请确保包含 -----BEGIN ... PRIVATE KEY-----");
            setAuthenticating(false);
            return;
          }
          setCustomSshKey(keyVal.trim());

          const sshRecord: SavedGitAccount = {
            id: `ssh-${Date.now()}`,
            type: "ssh",
            name: "自定义 SSH 密钥",
            sshKey: keyVal.trim(),
            lastUsed: Date.now(),
          };
          saveAccountToHistory(sshRecord);
          setSavedAccounts(getSavedAccounts());
        }
        setRepoInputMode("manual");
        message.success("SSH 密钥认证环境就绪！请在下一步输入 SSH 克隆地址 (git@...)");
      } else {
        // 公开开源仓库免密
        setRepoInputMode("manual");
        message.success("公开开源项目模式就绪！请在下一步输入仓库开源地址");
      }

      // 平滑推进到第 2 步：选择仓库与分支
      setStage("configure");
    } finally {
      setAuthenticating(false);
    }
  };

  // 下拉选择名下某个仓库
  const handleSelectDiscoveredRepo = (repo: RemoteUserRepoItem) => {
    const chosenUrl = repo.cloneUrl || repo.sshUrl;

    // 唯一性防重校验：同仓库同一地址只能接入一次
    const duplicate = gitRepos.find(
      (r) =>
        r.id !== editingRepo?.id &&
        normalizeGitRepoUrl(r.repoUrl) === normalizeGitRepoUrl(chosenUrl)
    );
    if (duplicate) {
      Modal.confirm({
        title: "该代码仓库已接入平台",
        icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
        content: (
          <div>
            代码仓库 <b>{repo.fullName || repo.name}</b> 此前已在系统中接入（已守护分支：<b>{duplicate.branch}</b>）。
            <br />
            同一个代码仓库在系统中只需配置一次。您可以直接切换到该仓库编辑分支或配置，无需重复新建。
          </div>
        ),
        okText: "前往编辑已有仓库",
        cancelText: "挑选其他项目",
        onOk: () => {
          handleOpenEdit(duplicate);
        },
        onCancel: () => {
          setCurrentRepoUrl("");
          form.setFieldsValue({ repoUrl: "", name: "" });
        },
      });
      return;
    }

    form.setFieldsValue({
      name: repo.name,
      repoUrl: chosenUrl,
    });
    setCurrentRepoUrl(chosenUrl);
    setCurrentRepoName(repo.name);
    if (repo.defaultBranch) {
      setDefaultBranchName(repo.defaultBranch);
      setSelectedBranches([repo.defaultBranch]);
    }
    // 自动拉取该仓库的真实远端分支
    triggerAutoFetchBranches(chosenUrl, "token", form.getFieldValue("accessToken") || currentToken);
  };

  // 拉取远端所有真实分支
  const triggerAutoFetchBranches = async (
    url: string,
    curAuthType: string,
    token?: string,
    sshKey?: string
  ) => {
    if (!url || !url.trim()) return;
    setFetchingBranches(true);

    try {
      const sshKeyToSend =
        curAuthType === "ssh" ? (sshInputMode === "server" ? "SYSTEM" : sshKey || customSshKey) : undefined;
      const res = await fetchRemoteBranchesApi({
        repoUrl: url.trim(),
        authType: curAuthType,
        accessToken: token || currentToken,
        sshKey: sshKeyToSend,
      });

      if (res.ok && res.branches && res.branches.length > 0) {
        setRemoteBranches(res.branches);
        const bestBranch = res.defaultBranch || res.branches[0];
        setDefaultBranchName(bestBranch);
        setSelectedBranches((prev) => (prev.length > 0 ? prev : [bestBranch]));
        message.success(`成功拉取到 ${res.branches.length} 个远端分支`);
      } else {
        message.warning(res.error || "未能拉取到远端分支，请检查 Git 地址与凭据");
      }
    } catch {
      message.error("拉取分支网络异常，请重试");
    } finally {
      setFetchingBranches(false);
    }
  };

  const handleManualFetchBranches = () => {
    const values = form.getFieldsValue();
    const url = values.repoUrl || currentRepoUrl;
    if (!url || !url.trim()) {
      message.warning("请先在上方输入或选择 Git 仓库");
      return;
    }
    triggerAutoFetchBranches(url, authType, values.accessToken || currentToken, values.sshKey);
  };

  // 快捷分支选择
  const selectAllBranches = () => {
    if (remoteBranches.length > 0) {
      setSelectedBranches(remoteBranches);
      message.info(`已全选所有 ${remoteBranches.length} 个分支`);
    } else {
      message.warning("请先点击「拉取远端分支」获取可用分支");
    }
  };

  const selectMainAndDevBranches = () => {
    if (remoteBranches.length === 0) {
      message.warning("请先点击「拉取远端分支」获取可用分支");
      return;
    }
    const matched = remoteBranches.filter((b) =>
      ["main", "master", "dev", "develop", "development", "release"].includes(b.toLowerCase())
    );
    if (matched.length > 0) {
      setSelectedBranches(matched);
      message.info(`已选中常用主干分支: ${matched.join(", ")}`);
    } else {
      setSelectedBranches([defaultBranchName]);
    }
  };

  // 移除某一个已选中的分支
  const handleRemoveBranchTag = (branchToRemove: string) => {
    setSelectedBranches((prev) => prev.filter((b) => b !== branchToRemove));
  };

  // 快速填入公开测试项目
  const handleQuickFill = (name: string, url: string, branch: string) => {
    form.setFieldsValue({
      name,
      repoUrl: url,
    });
    setCurrentRepoUrl(url);
    setCurrentRepoName(name);
    setRemoteBranches([branch]);
    setSelectedBranches([branch]);
    setDefaultBranchName(branch);
    triggerAutoFetchBranches(url, authType, currentToken);
  };

  // 保存代码库（真实持久化存储入库，零假数据）
  const handleSaveEditor = async () => {
    try {
      const values = form.getFieldsValue();
      const finalRepoUrl = currentRepoUrl || values.repoUrl || form.getFieldValue("repoUrl");
      if (!finalRepoUrl || !finalRepoUrl.trim()) {
        message.error("请先选择或输入目标代码仓库");
        return;
      }
      const finalName = currentRepoName || values.name || form.getFieldValue("name");
      if (!finalName || !finalName.trim()) {
        message.error("请输入代码仓库业务名称");
        return;
      }
      if (selectedBranches.length === 0) {
        message.error("请至少选择一个守护分支");
        return;
      }

      // 唯一性防重校验：同 URL 不可重复接入
      const duplicate = gitRepos.find(
        (r) =>
          r.id !== editingRepo?.id &&
          normalizeGitRepoUrl(r.repoUrl) === normalizeGitRepoUrl(finalRepoUrl)
      );
      if (duplicate) {
        message.warning(`代码仓库「${duplicate.name}」已存在于系统中，请勿重复添加！您可直接在列表中修改其配置。`);
        return;
      }

      setEditorSubmitting(true);

      const branchList = selectedBranches.join(",");
      const sshKeyToSend =
        authType === "ssh" ? (sshInputMode === "server" ? "SYSTEM" : values.sshKey || customSshKey) : undefined;

      const saved = await saveGitRepositoryApi(
        {
          id: editingRepo ? editingRepo.id : undefined,
          name: finalName.trim(),
          repoUrl: finalRepoUrl.trim(),
          branch: branchList,
          authType: authType,
          accessToken: values.accessToken || currentToken || form.getFieldValue("accessToken"),
          sshKey: sshKeyToSend,
          enabled: true,
        },
        workflowId
      );

      // 重新从后端数据库加载最新真实列表
      const freshList = await fetchGitRepositoriesApi(workflowId);
      setGitRepos(freshList);

      message.success(editingRepo ? "代码仓库配置已更新入库！" : "代码仓库已成功存入数据库！智能体守护就绪");
      setViewMode("list");
    } catch (err: any) {
      console.error("保存代码库失败", err);
      message.error(err.message || "保存代码库失败，请检查必填项");
    } finally {
      setEditorSubmitting(false);
    }
  };

  // 删除 / 解绑
  const handleDeleteRepo = async (id: string) => {
    try {
      await deleteGitRepositoryApi(id);
      setGitRepos((prev) => prev.filter((r) => r.id !== id));
      message.info("已解绑该代码库");
    } catch (err: any) {
      message.error(err.message || "解绑失败");
    }
  };

  // 测通并同步
  const handleTestAndSync = async (id: string) => {
    setTestingId(id);
    try {
      const updated = await syncGitRepositoryApi(id);
      setGitRepos((prev) => prev.map((r) => (r.id === id ? updated : r)));
      if (updated.status === "connected") {
        message.success(`实时连通成功！最新提交 #${updated.lastCommitSha} (${updated.lastCommitAuthor})`);
      } else {
        message.warning(`连通异常: ${updated.errorMsg || updated.healthMessage}`);
      }
    } catch {
      message.error("同步异常，请检查网络");
    } finally {
      setTestingId(null);
    }
  };

  // 顶部进度条百分比
  const getProgressPercent = () => {
    if (stage === "login") return userProfile?.ok ? 50 : 35;
    if (stage === "configure") {
      if (currentRepoUrl && selectedBranches.length > 0 && currentRepoName) return 100;
      if (currentRepoUrl) return 75;
      return 60;
    }
    return 100;
  };

  // ══════════════════════════════════════════════════════════════════
  // 视图一：单屏纯净工作台
  // 点击进度条可自由跳转步骤；第一个页面只有登录，登录后选择分支
  // ══════════════════════════════════════════════════════════════════
  if (viewMode === "editor") {
    const progressPercent = getProgressPercent();

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          height: "100%",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* 顶部微型控制栏 */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 10,
            padding: "8px 16px",
            border: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setViewMode("list")}
              style={{
                borderRadius: 8,
                height: 32,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#4f46e5",
                background: "#f8fafc",
                borderColor: "#c7d2fe",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>‹ 返回代码仓库列表</span>
              {gitRepos.length > 0 && (
                <Tag color="indigo" style={{ margin: 0, borderRadius: 10, fontSize: 11 }}>
                  {gitRepos.length}
                </Tag>
              )}
            </Button>

            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a" }}>
              {editingRepo
                ? `修改代码仓库配置 · ${editingRepo.name}`
                : stage === "login"
                ? "接入新代码仓库 · 第 1 步：账号认证与登录"
                : "接入新代码仓库 · 第 2 步：选择仓库与守护分支"}
            </div>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              {stage === "login"
                ? "（支持凭 GitHub Token 或 SSH 密钥真实鉴权）"
                : "（已连通账号，拉取真实分支下拉多选守护）"}
            </span>
          </div>

          <Space size={8}>
            {stage === "configure" && !editingRepo && (
              <Button
                icon={<SwapOutlined />}
                onClick={() => setStage("login")}
                style={{ borderRadius: 6, height: 30, fontSize: 12, color: "#64748b" }}
              >
                切换登录账号
              </Button>
            )}
            <Button
              onClick={() => setViewMode("list")}
              style={{ borderRadius: 6, height: 30, fontSize: 12, color: "#64748b" }}
            >
              取消
            </Button>
            {stage === "configure" && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={editorSubmitting}
                onClick={handleSaveEditor}
                style={{
                  borderRadius: 6,
                  height: 30,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.28)",
                  border: "none",
                  minWidth: 96,
                }}
              >
                保存并生效
              </Button>
            )}
          </Space>
        </div>

        {/* 顶部进度条：【支持点击进度条直接跳转相应步骤】 */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 10,
            padding: "10px 18px",
            border: "1px solid #e2e8f0",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              {[
                {
                  step: 1,
                  label: "1. 账号认证与登录",
                  done: stage === "configure",
                  active: stage === "login",
                  onClick: () => setStage("login"),
                },
                {
                  step: 2,
                  label: "2. 选择代码仓库与分支",
                  done: progressPercent === 100,
                  active: stage === "configure",
                  onClick: async () => {
                    if (stage === "login") {
                      await handleVerifyLoginAndProceed();
                    } else {
                      if (authType === "token" && userRepoList.length === 0) {
                        const token = currentToken || form.getFieldValue("accessToken");
                        if (token) {
                          await loadUserRepositories(token);
                        }
                      }
                      setStage("configure");
                    }
                  },
                },
                {
                  step: 3,
                  label: "3. 保存生效入库",
                  done: false,
                  active: progressPercent === 100,
                  onClick: () => {
                    if (stage === "configure") {
                      handleSaveEditor();
                    }
                  },
                },
              ].map((item) => (
                <div
                  key={item.step}
                  onClick={item.onClick}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: item.active || item.done ? 700 : 500,
                    color: item.done ? "#16a34a" : item.active ? "#4f46e5" : "#94a3b8",
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: item.active ? "#eef2ff" : "transparent",
                    transition: "all 0.15s ease",
                  }}
                  title="点击可直接切换到此步骤"
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: item.done ? "#f0fdf4" : item.active ? "#4f46e5" : "#f1f5f9",
                      color: item.done ? "#16a34a" : item.active ? "#ffffff" : "#94a3b8",
                      border: `1.5px solid ${item.done ? "#22c55e" : item.active ? "#4f46e5" : "#cbd5e1"}`,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {item.done ? "✓" : item.step}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>向导进度:</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: progressPercent === 100 ? "#16a34a" : "#4f46e5" }}>
                {progressPercent}%
              </span>
            </div>
          </div>

          <Progress
            percent={progressPercent}
            showInfo={false}
            strokeColor={{
              "0%": "#6366f1",
              "100%": "#10b981",
            }}
            size={["100%", 5]}
            style={{ margin: 0 }}
          />
        </div>

        {/* 主体双栏区域：左侧表单 + 右侧小记录框 */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "1fr 310px",
            gap: 12,
            overflow: "hidden",
          }}
        >
          {/* 左侧配置面板 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              padding: "18px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              overflowY: "auto",
            }}
          >
            <Form form={form} layout="vertical" autoComplete="off" style={{ margin: 0 }}>
              {/* ══════════════════════════════════════════════════════ */}
              {/* 阶段 1：【第一个页面只有登录】                            */}
              {/* ══════════════════════════════════════════════════════ */}
              {stage === "login" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* 历史保存账号（仅当真实登录过且本地有记录时才显示，无任何假数据） */}
                  {savedAccounts.length > 0 && (
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                        <HistoryOutlined style={{ color: "#4f46e5" }} />
                        <span>已登录过的历史账号 (点击一键快捷选用)：</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {savedAccounts.map((acc) => {
                          const isSelected = activeAccountId === acc.id || (userProfile && userProfile.login === acc.login);
                          return (
                            <div
                              key={acc.id}
                              onClick={() => handleSelectSavedAccount(acc)}
                              style={{
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 12px",
                                borderRadius: 6,
                                background: isSelected ? "#eef2ff" : "#ffffff",
                                border: `1.5px solid ${isSelected ? "#6366f1" : "#cbd5e1"}`,
                                fontSize: 12,
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? "#4f46e5" : "#334155",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {acc.avatarUrl ? (
                                <Avatar size={18} src={acc.avatarUrl} />
                              ) : acc.type === "ssh" ? (
                                <SafetyCertificateOutlined />
                              ) : (
                                <KeyOutlined />
                              )}
                              <span>{acc.name}</span>
                              <CloseOutlined
                                onClick={(e) => handleDeleteSavedAccount(e, acc.id)}
                                style={{ fontSize: 10, color: "#94a3b8", marginLeft: 4 }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 如果当前已经有成功登录的账号 Profile，展示高质感交互卡片 (解决“登录信息点不了”) */}
                  {userProfile && userProfile.ok ? (
                    <div
                      style={{
                        background: "linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)",
                        border: "1.5px solid #c7d2fe",
                        borderRadius: 10,
                        padding: "18px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <Avatar
                          size={46}
                          src={userProfile.avatarUrl}
                          icon={<UserOutlined />}
                          style={{ border: "2px solid #6366f1", boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)" }}
                        />
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{userProfile.name}</span>
                            <span style={{ fontSize: 13, color: "#6366f1", fontWeight: 600 }}>@{userProfile.login}</span>
                            <Tag color="success" icon={<CheckCircleFilled />} style={{ margin: 0, borderRadius: 10, fontSize: 11 }}>
                              已登录认证
                            </Tag>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                            GitHub 访问令牌有效 · 名下已同步 {userRepoList.length} 个代码仓库
                          </div>
                        </div>
                      </div>

                      <Space size="middle">
                        <Button
                          danger
                          type="text"
                          icon={<LogoutOutlined />}
                          onClick={handleLogoutCurrentProfile}
                          style={{ borderRadius: 6, fontSize: 12.5 }}
                        >
                          切换 / 登出此账号
                        </Button>
                        <Button
                          type="primary"
                          icon={<ArrowRightOutlined />}
                          loading={authenticating || fetchingUserRepos}
                          onClick={async () => {
                            if (authType === "token" && userRepoList.length === 0) {
                              const token = currentToken || form.getFieldValue("accessToken");
                              if (token) {
                                await loadUserRepositories(token);
                              }
                            }
                            setStage("configure");
                          }}
                          style={{
                            borderRadius: 6,
                            height: 38,
                            padding: "0 20px",
                            fontWeight: 600,
                            background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                            border: "none",
                            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                          }}
                        >
                          继续使用此账号选分支 ➔
                        </Button>
                      </Space>
                    </div>
                  ) : null}

                  {/* 登录方式选择单选卡片 */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                        请选择登录与鉴权方式（任选其一）：
                      </div>
                      <Button
                        type="link"
                        size="small"
                        icon={<BookOutlined />}
                        onClick={() => setGuidanceDrawerOpen(true)}
                        style={{ fontSize: 12, padding: 0, color: "#4f46e5", fontWeight: 600 }}
                      >
                        📖 令牌/密钥获取说明 ↗
                      </Button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      {/* 选项 1: Token */}
                      <div
                        onClick={() => {
                          setAuthType("token");
                          form.setFieldsValue({ authType: "token" });
                        }}
                        style={{
                          cursor: "pointer",
                          borderRadius: 10,
                          padding: "14px 16px",
                          background: authType === "token" ? "#faf5ff" : "#f8fafc",
                          border: `1.5px solid ${authType === "token" ? "#a855f7" : "#e2e8f0"}`,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          position: "relative",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {authType === "token" && (
                          <span style={{ position: "absolute", top: 10, right: 10, color: "#a855f7", fontSize: 14 }}>
                            <CheckCircleFilled />
                          </span>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13.5, color: authType === "token" ? "#7e22ce" : "#334155" }}>
                          <GithubOutlined />
                          <span>GitHub / GitLab 令牌</span>
                          <Tag color="purple" style={{ margin: 0, borderRadius: 4, fontSize: 10 }}>推荐</Tag>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.5 }}>
                          个人访问令牌登录，验证后可一键读取名下所有项目
                        </div>
                      </div>

                      {/* 选项 2: SSH */}
                      <div
                        onClick={() => {
                          setAuthType("ssh");
                          form.setFieldsValue({ authType: "ssh" });
                        }}
                        style={{
                          cursor: "pointer",
                          borderRadius: 10,
                          padding: "14px 16px",
                          background: authType === "ssh" ? "#eff6ff" : "#f8fafc",
                          border: `1.5px solid ${authType === "ssh" ? "#3b82f6" : "#e2e8f0"}`,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          position: "relative",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {authType === "ssh" && (
                          <span style={{ position: "absolute", top: 10, right: 10, color: "#3b82f6", fontSize: 14 }}>
                            <CheckCircleFilled />
                          </span>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13.5, color: authType === "ssh" ? "#1d4ed8" : "#334155" }}>
                          <SafetyCertificateOutlined />
                          <span>SSH 密钥认证</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.5 }}>
                          粘贴 SSH 私钥或选用服务器默认密钥，免密握手
                        </div>
                      </div>

                      {/* 选项 3: 公开免密 */}
                      <div
                        onClick={() => {
                          setAuthType("none");
                          form.setFieldsValue({ authType: "none" });
                        }}
                        style={{
                          cursor: "pointer",
                          borderRadius: 10,
                          padding: "14px 16px",
                          background: authType === "none" ? "#f0fdf4" : "#f8fafc",
                          border: `1.5px solid ${authType === "none" ? "#22c55e" : "#e2e8f0"}`,
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          position: "relative",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {authType === "none" && (
                          <span style={{ position: "absolute", top: 10, right: 10, color: "#22c55e", fontSize: 14 }}>
                            <CheckCircleFilled />
                          </span>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13.5, color: authType === "none" ? "#15803d" : "#334155" }}>
                          <GlobalOutlined />
                          <span>公开开源项目</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.5 }}>
                          无需账号凭据，公开仓库地址免密直连
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ────────────────────────────────────────── */}
                  {/* Token 登录输入面板                         */}
                  {/* ────────────────────────────────────────── */}
                  {authType === "token" && !userProfile && (
                    <div style={{ background: "#faf5ff", padding: "16px 18px", borderRadius: 10, border: "1px solid #f3e8ff", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#6b21a8" }}>
                            输入 GitHub 访问令牌 (Token) 完成登录：
                          </span>
                        </div>
                        <a
                          href="https://github.com/settings/tokens/new?description=OwnAgent-Platform&scopes=repo,read:user"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 12,
                            color: "#7e22ce",
                            fontWeight: 600,
                            background: "#ffffff",
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid #e9d5ff",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          ⚡ GitHub 官方一键授权直达 (免找菜单已预勾选) ↗
                        </a>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Form.Item name="accessToken" noStyle>
                          <Input.Password
                            prefix={<KeyOutlined style={{ color: "#94a3b8" }} />}
                            placeholder="粘贴您的 Personal Access Token (如 ghp_...)"
                            autoComplete="new-password"
                            spellCheck={false}
                            onPressEnter={handleVerifyLoginAndProceed}
                            style={{ borderRadius: 8, height: 42, fontSize: 13 }}
                          />
                        </Form.Item>

                        <Button
                          type="primary"
                          loading={authenticating || fetchingUserRepos}
                          onClick={handleVerifyLoginAndProceed}
                          style={{
                            borderRadius: 8,
                            height: 42,
                            padding: "0 22px",
                            fontSize: 13,
                            fontWeight: 600,
                            background: "#7e22ce",
                            borderColor: "#7e22ce",
                            flexShrink: 0,
                          }}
                        >
                          立即登录验证
                        </Button>
                      </div>

                      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                        💡 提示：点击右上角链接直达 GitHub 官方打勾页，在页面底部点击绿色「Generate token」按钮后，复制粘贴即可一键登录！
                      </div>
                    </div>
                  )}

                  {/* ────────────────────────────────────────── */}
                  {/* SSH 密钥登录面板                           */}
                  {/* ────────────────────────────────────────── */}
                  {authType === "ssh" && (
                    <div style={{ background: "#eff6ff", padding: "16px 18px", borderRadius: 10, border: "1px solid #dbeafe", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
                        SSH 私钥认证设置：
                      </div>

                      <Radio.Group
                        value={sshInputMode}
                        onChange={(e) => setSshInputMode(e.target.value)}
                        style={{ marginBottom: 4 }}
                      >
                        <Radio value="custom">粘贴 SSH 私钥 (推荐，适用任意机器与云平台)</Radio>
                        <Radio value="server">使用部署服务器已存在的默认密钥 (~/.ssh/id_ed25519)</Radio>
                      </Radio.Group>

                      {sshInputMode === "custom" ? (
                        <div>
                          <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
                            请粘贴您的 SSH 客户端私钥（Private Key 内容，系统仅临时解密调用）：
                          </div>
                          <Form.Item name="sshKey" noStyle>
                            <Input.TextArea
                              rows={5}
                              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                              value={customSshKey}
                              onChange={(e) => setCustomSshKey(e.target.value)}
                              style={{ fontFamily: "monospace", fontSize: 12, borderRadius: 6 }}
                            />
                          </Form.Item>
                        </div>
                      ) : (
                        <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: 6, border: "1px solid #bfdbfe", fontSize: 12, color: "#1e3a8a" }}>
                          ℹ️ 系统将直接使用部署环境本机 <code>~/.ssh/id_ed25519</code> 私钥进行握手。请确保您的公钥已添加到代码托管平台的 SSH Keys 中。
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Button
                          type="primary"
                          onClick={handleVerifyLoginAndProceed}
                          style={{ borderRadius: 6, height: 36, fontWeight: 600, background: "#1d4ed8" }}
                        >
                          确认凭据并进入下一步
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ────────────────────────────────────────── */}
                  {/* 公开免密面板                              */}
                  {/* ────────────────────────────────────────── */}
                  {authType === "none" && (
                    <div style={{ background: "#f0fdf4", padding: "16px 18px", borderRadius: 10, border: "1px solid #dcfce7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#166534", fontSize: 13 }}>
                          公开开源项目（免密模式）
                        </div>
                        <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>
                          该模式适用于任何公开可见的 GitHub / GitLab 开源项目，无需输入任何账号和私钥。
                        </div>
                      </div>
                      <Button
                        type="primary"
                        onClick={handleVerifyLoginAndProceed}
                        style={{ borderRadius: 6, height: 36, fontWeight: 600, background: "#16a34a", borderColor: "#16a34a" }}
                      >
                        直接进入下一步
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* ══════════════════════════════════════════════════════ */
                /* 阶段 2：【登录之后，再让选择分支与仓库出来】            */
                /* ══════════════════════════════════════════════════════ */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* 当前已认证账号横幅 */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "10px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {userProfile?.avatarUrl ? (
                        <Avatar size={28} src={userProfile.avatarUrl} />
                      ) : (
                        <Avatar size={28} icon={<UserOutlined />} style={{ background: "#4f46e5" }} />
                      )}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                          <span>🟢 已成功登录</span>
                          <span style={{ color: "#64748b" }}>|</span>
                          <span style={{ color: "#4f46e5" }}>
                            {authType === "token"
                              ? userProfile?.login
                                ? `@${userProfile.login} (${userProfile.name || "GitHub 用户"})`
                                : "GitHub Token 令牌认证"
                              : authType === "ssh"
                              ? "SSH 密钥认证"
                              : "公开开源项目"}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                          {userRepoList.length > 0
                            ? `已成功读取到名下 ${userRepoList.length} 个项目，可在下方直接选择`
                            : "输入目标仓库的远程地址即可自动分析分支"}
                        </div>
                      </div>
                    </div>

                    <Button
                      type="link"
                      size="small"
                      icon={<SwapOutlined />}
                      onClick={() => setStage("login")}
                      style={{ fontSize: 12, color: "#4f46e5", fontWeight: 600 }}
                    >
                      切换登录账号
                    </Button>
                  </div>

                  {/* 1. 关联目标代码仓库 */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>① 关联目标代码仓库</span>
                        {userRepoList.length > 0 && (
                          <Tag color="purple" style={{ margin: 0, borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                            已同步 {userRepoList.length} 个项目
                          </Tag>
                        )}
                      </div>

                      <Space size={8}>
                        {userRepoList.length > 0 && (
                          <Button
                            type="link"
                            size="small"
                            icon={<SwapOutlined />}
                            onClick={() => setRepoInputMode(repoInputMode === "select" ? "manual" : "select")}
                            style={{ fontSize: 12, padding: 0, color: "#7e22ce", fontWeight: 600 }}
                          >
                            {repoInputMode === "select" ? "切换为手动输入 URL" : `从名下 ${userRepoList.length} 个项目下拉挑选`}
                          </Button>
                        )}
                      </Space>
                    </div>

                    {/* 加载名下项目状态 */}
                    {fetchingUserRepos && (
                      <div
                        style={{
                          background: "#faf5ff",
                          border: "1px dashed #d8b4fe",
                          borderRadius: 8,
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          color: "#7e22ce",
                          fontSize: 12.5,
                        }}
                      >
                        <Spin size="small" />
                        <span>正在同步读取您名下的真实代码仓库，请稍候...</span>
                      </div>
                    )}

                    {/* 下拉挑选模式 */}
                    {!fetchingUserRepos && repoInputMode === "select" && userRepoList.length > 0 && (
                      <div>
                        {currentRepoUrl ? (
                          /* 已锁定项目卡片 */
                          <div
                            style={{
                              background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                              border: "1.5px solid #cbd5e1",
                              borderRadius: 8,
                              padding: "12px 16px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 8,
                                  background: "#ede9fe",
                                  color: "#6b21a8",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 20,
                                }}
                              >
                                <GithubOutlined />
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                                    {userRepoList.find((r) => (r.cloneUrl || r.sshUrl) === currentRepoUrl)?.fullName || currentRepoName || currentRepoUrl}
                                  </span>
                                  {userRepoList.find((r) => (r.cloneUrl || r.sshUrl) === currentRepoUrl)?.isPrivate ? (
                                    <Tag color="default" style={{ margin: 0, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                      🔒 私有项目
                                    </Tag>
                                  ) : (
                                    <Tag color="success" style={{ margin: 0, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                      🌐 公开项目
                                    </Tag>
                                  )}
                                  <Tag color="purple" style={{ margin: 0, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                    🌿 默认: {userRepoList.find((r) => (r.cloneUrl || r.sshUrl) === currentRepoUrl)?.defaultBranch || defaultBranchName || "main"}
                                  </Tag>
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace", marginTop: 3 }}>
                                  {currentRepoUrl}
                                </div>
                              </div>
                            </div>

                            <Button
                              icon={<SwapOutlined />}
                              onClick={() => {
                                setCurrentRepoUrl("");
                                form.setFieldsValue({ repoUrl: "" });
                              }}
                              style={{
                                borderRadius: 6,
                                height: 32,
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#4f46e5",
                                borderColor: "#c7d2fe",
                                background: "#ffffff",
                              }}
                            >
                              更换其他项目 ▾
                            </Button>
                          </div>
                        ) : (
                          /* 下拉选择框 */
                          <Select
                            showSearch
                            size="large"
                            value={currentRepoUrl || undefined}
                            placeholder="🔍 搜索并挑选您名下的代码仓库 (输入关键字直接过滤)..."
                            style={{ width: "100%", height: 42 }}
                            popupMatchSelectWidth={false}
                            dropdownStyle={{ borderRadius: 8, padding: 6 }}
                            onChange={(val) => {
                              const found = userRepoList.find((r) => (r.cloneUrl || r.sshUrl) === val);
                              if (found) handleSelectDiscoveredRepo(found);
                            }}
                            filterOption={(input, option) => {
                              const label = (option?.label as string) || (option?.value as string) || "";
                              return label.toLowerCase().includes(input.toLowerCase());
                            }}
                            options={userRepoList.map((r) => {
                              const val = r.cloneUrl || r.sshUrl;
                              const isBound = gitRepos.some(
                                (existing) =>
                                  existing.id !== editingRepo?.id &&
                                  normalizeGitRepoUrl(existing.repoUrl) === normalizeGitRepoUrl(val)
                              );
                              return {
                                value: val,
                                label: `${r.fullName || r.name} ${val}`,
                                labelNode: (
                                  <div style={{ padding: "4px 2px", display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: isBound ? "#4f46e5" : "#0f172a" }}>
                                        {r.fullName || r.name}
                                      </span>
                                      <Space size={4}>
                                        {isBound && (
                                          <Tag color="gold" style={{ margin: 0, fontSize: 10, borderRadius: 4, fontWeight: 700 }}>
                                            🟢 已在平台接入
                                          </Tag>
                                        )}
                                        <Tag color={r.isPrivate ? "default" : "green"} style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
                                          {r.isPrivate ? "🔒 私有" : "🌐 公开"}
                                        </Tag>
                                        <Tag color="purple" style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
                                          🌿 {r.defaultBranch || "main"}
                                        </Tag>
                                      </Space>
                                    </div>
                                    <div style={{ fontSize: 11, color: isBound ? "#6366f1" : "#94a3b8", fontFamily: "monospace" }}>
                                      {val} {isBound && "（点击将直接定位修改已有配置）"}
                                    </div>
                                  </div>
                                ),
                              };
                            })}
                            optionRender={(opt) => (opt.data as any).labelNode || opt.label}
                          />
                        )}
                      </div>
                    )}

                    {/* 手动输入模式或备用输入 */}
                    {!fetchingUserRepos && (repoInputMode === "manual" || (repoInputMode === "select" && userRepoList.length === 0)) && (
                      <div>
                        <Form.Item
                          name="repoUrl"
                          rules={[{ required: true, message: "请输入合法的 Git 远程地址" }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            size="large"
                            autoComplete="new-password"
                            spellCheck={false}
                            prefix={<LinkOutlined style={{ color: "#94a3b8" }} />}
                            placeholder={
                              authType === "ssh"
                                ? "git@github.com:org/repo.git"
                                : "https://github.com/org/repo.git"
                            }
                            value={currentRepoUrl}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentRepoUrl(val);
                              const extracted = autoExtractRepoName(val);
                              if (extracted && !form.getFieldValue("name")) {
                                form.setFieldsValue({ name: extracted });
                                setCurrentRepoName(extracted);
                              }
                            }}
                            onBlur={() => {
                              const url = form.getFieldValue("repoUrl");
                              if (url) {
                                triggerAutoFetchBranches(url, authType, currentToken, form.getFieldValue("sshKey"));
                              }
                            }}
                            style={{ borderRadius: 8, height: 42, fontSize: 13, fontFamily: "monospace" }}
                          />
                        </Form.Item>

                        {/* 实时防重预检提示 */}
                        {(() => {
                          const dup = gitRepos.find(
                            (r) =>
                              r.id !== editingRepo?.id &&
                              currentRepoUrl &&
                              normalizeGitRepoUrl(r.repoUrl) === normalizeGitRepoUrl(currentRepoUrl)
                          );
                          if (!dup) return null;
                          return (
                            <div
                              style={{
                                marginTop: 8,
                                padding: "8px 14px",
                                background: "#fffbe6",
                                border: "1px solid #ffe58f",
                                borderRadius: 8,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div style={{ fontSize: 12.5, color: "#d48806", display: "flex", alignItems: "center", gap: 6 }}>
                                <ExclamationCircleOutlined />
                                <span>
                                  该仓库已在系统中接入（名称：<b>{dup.name}</b> · 分支：<b>{dup.branch}</b>），无需重复创建。
                                </span>
                              </div>
                              <Button
                                size="small"
                                type="primary"
                                ghost
                                onClick={() => handleOpenEdit(dup)}
                                style={{ fontSize: 12, height: 26, borderRadius: 4 }}
                              >
                                切换为编辑该仓库
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* 2. 选择分支：【极简高质感分支选择看板，告别丑陋多选框】 */}
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>② 选择要守护的目标分支（点击直接选中/取消）</span>
                        <Tag color="indigo" style={{ borderRadius: 10, fontSize: 11, margin: 0, fontWeight: 600 }}>
                          已选 {selectedBranches.length} / 共 {remoteBranches.length} 个远端分支
                        </Tag>
                      </div>

                      <Space size={4}>
                        <Button
                          type="primary"
                          icon={<ReloadOutlined />}
                          loading={fetchingBranches}
                          onClick={handleManualFetchBranches}
                          style={{
                            borderRadius: 6,
                            fontSize: 11.5,
                            height: 28,
                            background: "#4f46e5",
                            borderColor: "#4f46e5",
                            fontWeight: 600,
                          }}
                        >
                          拉取远端分支
                        </Button>
                        <Button size="small" onClick={selectAllBranches} style={{ fontSize: 11.5, height: 28, borderRadius: 6 }}>
                          全选
                        </Button>
                        <Button size="small" onClick={selectMainAndDevBranches} style={{ fontSize: 11.5, height: 28, borderRadius: 6 }}>
                          常用主干
                        </Button>
                      </Space>
                    </div>

                    {/* 分支药丸卡片池 (纯净高颜值卡片点击，绝无丑陋空框) */}
                    <div
                      style={{
                        background: "#f8fafc",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {remoteBranches.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
                          <BranchesOutlined />
                          <span>在上方选择或输入仓库后将自动拉取真实分支，也可点击右上角「拉取远端分支」</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          {remoteBranches.map((b) => {
                            const isSelected = selectedBranches.includes(b);
                            const isDefault = b === defaultBranchName;
                            return (
                              <div
                                key={b}
                                onClick={() => {
                                  if (isSelected) {
                                    if (selectedBranches.length === 1) {
                                      message.warning("请至少保留一个守护分支");
                                      return;
                                    }
                                    setSelectedBranches(selectedBranches.filter((x) => x !== b));
                                  } else {
                                    setSelectedBranches([...selectedBranches, b]);
                                  }
                                }}
                                style={{
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "6px 14px",
                                  borderRadius: 20,
                                  background: isSelected ? "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" : "#ffffff",
                                  border: `1.5px solid ${isSelected ? "#6366f1" : "#cbd5e1"}`,
                                  color: isSelected ? "#ffffff" : "#334155",
                                  fontSize: 12.5,
                                  fontWeight: isSelected ? 600 : 500,
                                  boxShadow: isSelected ? "0 0 12px rgba(99, 102, 241, 0.35)" : "0 1px 2px rgba(0,0,0,0.02)",
                                  transition: "all 0.15s ease",
                                  userSelect: "none",
                                }}
                              >
                                {isSelected ? (
                                  <span className="cyber-radar-dot-green" style={{ width: 6, height: 6, marginRight: 2 }} />
                                ) : (
                                  <BranchesOutlined style={{ fontSize: 12, color: "#64748b" }} />
                                )}
                                <span className="font-mono-cyber">{b}</span>
                                {isDefault && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      background: isSelected ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                                      color: isSelected ? "#ffffff" : "#64748b",
                                      padding: "1px 6px",
                                      borderRadius: 10,
                                      fontWeight: 600,
                                    }}
                                  >
                                    主干
                                  </span>
                                )}
                                {isSelected ? (
                                  <CheckOutlined style={{ fontSize: 11, color: "#ffffff" }} />
                                ) : (
                                  <PlusOutlined style={{ fontSize: 10, color: "#94a3b8" }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {remoteBranches.length > 0 && (
                        <div style={{ fontSize: 11.5, color: "#94a3b8", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed #e2e8f0", paddingTop: 8 }}>
                          <span>💡 点击分支药丸即可自由勾选/取消。已选中的分支将被智能体纳入代码巡检守护。</span>
                          <span style={{ color: "#4f46e5", fontWeight: 600 }}>当前已选: {selectedBranches.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. 代码仓库业务名称 */}
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                      ③ 代码仓库业务名称
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, marginLeft: 6 }}>
                        （已自动提取，您可自定义业务直观名字）
                      </span>
                    </div>
                    <Form.Item
                      name="name"
                      rules={[{ required: true, message: "请输入代码仓库业务名称" }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input
                        size="large"
                        autoComplete="new-password"
                        spellCheck={false}
                        placeholder="如：核心业务网关服务 (gateway-service)"
                        value={currentRepoName}
                        onChange={(e) => setCurrentRepoName(e.target.value)}
                        style={{ borderRadius: 8, height: 42, fontSize: 13 }}
                      />
                    </Form.Item>
                  </div>
                </div>
              )}
            </Form>
          </div>

          {/* 右侧小记录框 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              padding: "16px 16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13.5, color: "#0f172a" }}>
                  <AuditOutlined style={{ color: "#4f46e5" }} />
                  <span>配置小记录清单</span>
                </div>
                <Tag color={stage === "configure" ? "success" : userProfile?.ok ? "success" : "processing"} style={{ margin: 0, borderRadius: 10, fontSize: 10.5 }}>
                  {stage === "configure" ? "已认证" : userProfile?.ok ? "已登录" : "待登录"}
                </Tag>
              </div>

              {/* 记录项 1: 登录认证方式 */}
              <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>🔑 登录认证方式</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                  {authType === "token" && <Tag color="purple" style={{ margin: 0 }}>GitHub / GitLab Token</Tag>}
                  {authType === "ssh" && <Tag color="blue" style={{ margin: 0 }}>SSH 密钥认证</Tag>}
                  {authType === "none" && <Tag color="green" style={{ margin: 0 }}>公开开源项目</Tag>}
                </div>
                {userProfile?.login && (
                  <div style={{ fontSize: 11.5, color: "#4f46e5", marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                    <UserOutlined />
                    <span>@{userProfile.login}</span>
                  </div>
                )}
              </div>

              {/* 记录项 2: 代码仓库 */}
              <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>📦 目标代码仓库</div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: currentRepoUrl ? "#0f172a" : "#94a3b8",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                    maxHeight: 40,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {currentRepoUrl || (stage === "login" ? "登录后在下一步选择" : "尚未选择代码仓库")}
                </div>
              </div>

              {/* 记录项 3: 监控分支 */}
              <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
                  <span>🌿 守护分支清单</span>
                  <span style={{ color: "#4f46e5", fontWeight: 600 }}>{selectedBranches.length} 个</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 68, overflowY: "auto" }}>
                  {selectedBranches.length > 0 ? (
                    selectedBranches.map((b) => (
                      <Tag
                        key={b}
                        color="indigo"
                        closable
                        onClose={() => handleRemoveBranchTag(b)}
                        style={{ margin: 0, fontSize: 11, borderRadius: 4 }}
                      >
                        {b}
                      </Tag>
                    ))
                  ) : (
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                      {stage === "login" ? "登录后下拉勾选" : "请拉取并勾选目标分支"}
                    </span>
                  )}
                </div>
              </div>

              {/* 记录项 4: 业务名称 */}
              <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>🏢 业务名称</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: currentRepoName ? "#0f172a" : "#94a3b8" }}>
                  {currentRepoName || (stage === "login" ? "登录后自动提取" : "待输入业务名称")}
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div style={{ paddingTop: 12, borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 6 }}>
              {stage === "login" ? (
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  loading={authenticating || fetchingUserRepos}
                  onClick={handleVerifyLoginAndProceed}
                  style={{
                    width: "100%",
                    height: 40,
                    fontSize: 13.5,
                    fontWeight: 600,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                    boxShadow: "0 2px 10px rgba(99, 102, 241, 0.35)",
                    border: "none",
                  }}
                >
                  {userProfile?.ok ? "使用当前账号继续选分支 ➔" : "验证登录并进入下一步"}
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  icon={<CheckOutlined />}
                  loading={editorSubmitting}
                  onClick={handleSaveEditor}
                  style={{
                    width: "100%",
                    height: 40,
                    fontSize: 13.5,
                    fontWeight: 600,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                    boxShadow: "0 2px 10px rgba(99, 102, 241, 0.35)",
                    border: "none",
                  }}
                >
                  保存并生效入库
                </Button>
              )}

              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
                {stage === "login" ? "真实官方验证，登录后自动提取分支" : "持久化存入数据库，智能体立即守护"}
              </div>
            </div>
          </div>
        </div>

        {/* 侧滑指引抽屉 */}
        <Drawer
          title="Git 访问令牌 (Token) 与 SSH 密钥获取说明"
          placement="right"
          width={480}
          open={guidanceDrawerOpen}
          onClose={() => setGuidanceDrawerOpen(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)",
                border: "1px solid #c7d2fe",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#4338ca", fontSize: 13 }}>
                ⚡ GitHub 官方一键预打勾直达链接
              </div>
              <div style={{ fontSize: 11.5, color: "#6366f1", marginTop: 4, lineHeight: 1.5 }}>
                点击下方按钮直达 GitHub 官方授权生成页，**系统已全自动预勾选好所需权限 (`repo, read:user`)**，页面底部直接点击绿色按钮「Generate token」即可！
              </div>
              <div style={{ marginTop: 8 }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<ExportOutlined />}
                  href="https://github.com/settings/tokens/new?description=OwnAgent-Platform&scopes=repo,read:user"
                  target="_blank"
                  rel="noreferrer"
                  style={{ borderRadius: 6, background: "#4f46e5", borderColor: "#4f46e5", fontSize: 11.5 }}
                >
                  🚀 直达 GitHub 官方预勾选页 ↗
                </Button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              {(
                [
                  { key: "github", label: "GitHub" },
                  { key: "gitlab", label: "GitLab" },
                  { key: "gitee", label: "Gitee 码云" },
                  { key: "coding", label: "腾讯云 CODING" },
                ] as const
              ).map((p) => (
                <Tag
                  key={p.key}
                  onClick={() => setGuidePlatform(p.key)}
                  style={{
                    cursor: "pointer",
                    margin: 0,
                    borderRadius: 6,
                    padding: "3px 8px",
                    fontSize: 11.5,
                    fontWeight: guidePlatform === p.key ? 700 : 400,
                    background: guidePlatform === p.key ? "#4f46e5" : "#ffffff",
                    color: guidePlatform === p.key ? "#ffffff" : "#475569",
                    border: `1px solid ${guidePlatform === p.key ? "#4f46e5" : "#cbd5e1"}`,
                  }}
                >
                  {p.label}
                </Tag>
              ))}
            </div>

            {guidePlatform === "github" && (
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: 14, border: "1px solid #e2e8f0", fontSize: 12.5, lineHeight: 1.8, color: "#334155" }}>
                <strong>GitHub 手动获取步骤：</strong><br />
                1. 登录 GitHub 网页，点击右上角头像 ➔ <strong>Settings（设置）</strong><br />
                2. 侧边栏滑到底部，点击 <strong>Developer Settings</strong><br />
                3. 选择 <strong>Personal access tokens</strong> ➔ <strong>Tokens (classic)</strong><br />
                4. 点击 <strong>Generate new token</strong>，勾选 <code style={{ color: "#4f46e5" }}>repo</code> 读写权限并生成。
              </div>
            )}

            {guidePlatform === "gitlab" && (
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: 14, border: "1px solid #e2e8f0", fontSize: 12.5, lineHeight: 1.8, color: "#334155" }}>
                <strong>GitLab 令牌获取步骤：</strong><br />
                1. 登录 GitLab，点击右上角头像 ➔ <strong>Edit profile</strong><br />
                2. 左侧菜单选择 <strong>Access Tokens</strong><br />
                3. 点击 <strong>Add new token</strong>，勾选 <code style={{ color: "#4f46e5" }}>read_repository</code> 权限并生成。
              </div>
            )}

            {guidePlatform === "gitee" && (
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: 14, border: "1px solid #e2e8f0", fontSize: 12.5, lineHeight: 1.8, color: "#334155" }}>
                <strong>Gitee 私人令牌获取步骤：</strong><br />
                1. 登录 Gitee，点击右上角头像 ➔ <strong>设置</strong><br />
                2. 左侧安全设置中点击 <strong>私人令牌</strong> ➔「+ 生成新令牌」<br />
                3. 勾选 <code style={{ color: "#4f46e5" }}>projects</code> 权限并提交。
              </div>
            )}

            {guidePlatform === "coding" && (
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: 14, border: "1px solid #e2e8f0", fontSize: 12.5, lineHeight: 1.8, color: "#334155" }}>
                <strong>腾讯云 CODING / SSH 部署密钥说明：</strong><br />
                1. 在本地或服务器生成密钥对：<code>ssh-keygen -t ed25519</code><br />
                2. 将 <code>.pub</code> 公钥内容添加至 CODING 的「个人设置 ➔ SSH 公钥」<br />
                3. 在本系统 SSH 密钥认证框中粘贴对应的私钥，即可免密拉取。
              </div>
            )}
          </div>
        </Drawer>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 视图二：代码仓库资产管理大厅 (Master View)
  // 支持完整增删改查 (CRUD)、实时连通探测、搜索过滤
  // ══════════════════════════════════════════════════════════════════
  const filteredRepos = gitRepos.filter((repo) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      repo.name.toLowerCase().includes(q) ||
      repo.repoUrl.toLowerCase().includes(q) ||
      (repo.branch && repo.branch.toLowerCase().includes(q))
    );
  });

  const connectedCount = gitRepos.filter((r) => r.status === "connected").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto", padding: "2px" }}>
      {/* 顶部标题、搜索与快捷操作栏 */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <BranchesOutlined style={{ color: "#4f46e5" }} />
            <span>Git 代码仓库资产大厅</span>
            <Tag color="indigo" style={{ borderRadius: 12, margin: 0, fontSize: 11.5, fontWeight: 600 }}>
              共 {gitRepos.length} 个代码仓库
            </Tag>
          </div>

          <Space size={6}>
            <Tag color="success" style={{ margin: 0, borderRadius: 12, fontSize: 11 }}>
              🟢 {connectedCount} 个连通正常
            </Tag>
          </Space>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {gitRepos.length > 0 && (
            <Input
              allowClear
              placeholder="🔍 搜索仓库名称或 URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 220, borderRadius: 8, height: 34, fontSize: 12.5 }}
            />
          )}

          <Button
            icon={<ReloadOutlined />}
            loading={loadingList}
            onClick={loadInitialData}
            style={{ borderRadius: 8, height: 34, fontSize: 12.5, color: "#475569" }}
          >
            刷新数据
          </Button>

          {onNextStep && gitRepos.length > 0 && (
            <Button
              icon={<ArrowRightOutlined />}
              onClick={onNextStep}
              style={{
                borderRadius: 8,
                height: 34,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#4f46e5",
                background: "#eef2ff",
                borderColor: "#c7d2fe",
              }}
            >
              下一步: 提示词设定 ➔
            </Button>
          )}

          <Button
            type="primary"
            className="btn-cyber-primary"
            icon={<PlusOutlined />}
            onClick={handleOpenAdd}
            style={{
              height: 34,
              fontSize: 12.5,
              padding: "0 16px",
            }}
          >
            接入新代码仓库
          </Button>
        </div>
      </div>

      {/* 仓库卡片网格 */}
      <Spin spinning={loadingList} tip="正在同步代码库状态...">
        {gitRepos.length === 0 ? (
          <div
            style={{
              border: "1.5px dashed #cbd5e1",
              borderRadius: 12,
              padding: "48px 24px",
              textAlign: "center",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)",
                color: "#4f46e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                border: "1px solid #c7d2fe",
              }}
            >
              <BranchesOutlined />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                尚未绑定任何 Git 代码仓库
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, maxWidth: 460 }}>
                将您的 GitHub、GitLab 或私人代码库接入平台，智能体将全天候针对各分支执行代码巡检与质量守护。
              </div>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={handleOpenAdd}
              style={{
                borderRadius: 8,
                height: 38,
                fontWeight: 600,
                fontSize: 13.5,
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                boxShadow: "0 2px 10px rgba(99, 102, 241, 0.3)",
                border: "none",
                padding: "0 24px",
              }}
            >
              立即绑定第一个代码库
            </Button>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: 10,
              padding: "36px 20px",
              textAlign: "center",
              background: "#ffffff",
              color: "#64748b",
              fontSize: 13,
            }}
          >
            未检索到与「{searchQuery}」匹配的代码仓库
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
              gap: 14,
            }}
          >
            {filteredRepos.map((repo) => {
              const isWarning = repo.healthStatus === "warning";
              const isError = repo.status === "error" || repo.healthStatus === "error";

              const branchList = repo.branch
                ? repo.branch.split(",").map((s) => s.trim()).filter(Boolean)
                : ["main"];

              return (
                <div
                  key={repo.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: 10,
                    border: `1.5px solid ${isError ? "#fecaca" : "#e2e8f0"}`,
                    padding: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 12,
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div>
                    {/* 头部：图标 + 仓库名称 + 连通状态 */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 8,
                            background: isError ? "#fef2f2" : "#eef2ff",
                            color: isError ? "#ef4444" : "#4f46e5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          <GithubOutlined />
                        </div>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a" }}>
                            {repo.name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                            <Tag style={{ margin: 0, borderRadius: 4, fontSize: 10.5, background: "#f8fafc", color: "#475569" }}>
                              {repo.authType === "token" ? "GitHub Token" : repo.authType === "ssh" ? "SSH 密钥" : "公开免密"}
                            </Tag>
                          </div>
                        </div>
                      </div>

                      {isError ? (
                        <Tag color="error" icon={<CloseCircleFilled />} style={{ margin: 0, borderRadius: 10, fontSize: 10.5 }}>
                          连通异常
                        </Tag>
                      ) : isWarning ? (
                        <Tag color="warning" icon={<WarningFilled />} style={{ margin: 0, borderRadius: 10, fontSize: 10.5 }}>
                          需关注
                        </Tag>
                      ) : (
                        <Tag color="success" icon={<CheckCircleFilled />} style={{ margin: 0, borderRadius: 10, fontSize: 10.5 }}>
                          连通正常
                        </Tag>
                      )}
                    </div>

                    {/* URL 地址 */}
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "#475569",
                        marginTop: 10,
                        fontFamily: "monospace",
                        background: "#f8fafc",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #f1f5f9",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <LinkOutlined style={{ marginRight: 6, color: "#94a3b8" }} />
                        {repo.repoUrl}
                      </div>
                      <Tooltip title="复制克隆地址">
                        <Button
                          type="text"
                          size="small"
                          icon={<ExportOutlined />}
                          onClick={() => {
                            navigator.clipboard.writeText(repo.repoUrl);
                            message.success("已复制 Git 远程地址");
                          }}
                          style={{ fontSize: 11, height: 20, padding: "0 4px", color: "#6366f1" }}
                        />
                      </Tooltip>
                    </div>

                    {/* 守护分支清单看板 */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>🌿 守护分支清单:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {branchList.map((b) => (
                          <Tag
                            key={b}
                            style={{
                              margin: 0,
                              borderRadius: 4,
                              fontSize: 11,
                              background: "#eef2ff",
                              color: "#4338ca",
                              border: "1px solid #c7d2fe",
                              fontWeight: 500,
                            }}
                          >
                            🌿 {b}
                          </Tag>
                        ))}
                      </div>
                    </div>

                    {/* 最新提交动态遥测 */}
                    {repo.lastCommitSha ? (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                          fontSize: 11.5,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#4f46e5" }}>
                            #{repo.lastCommitSha}
                          </span>
                          <span style={{ color: "#94a3b8", fontSize: 10.5 }}>
                            {repo.lastCommitAuthor} · {repo.lastCommitTime || "刚刚"}
                          </span>
                        </div>
                        <div style={{ color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {repo.lastCommitMessage || "暂无提交说明"}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 10, padding: "6px 10px", borderRadius: 6, background: "#fef2f2", fontSize: 11, color: "#dc2626" }}>
                        {repo.errorMsg || "未拉取到远端提交记录，点击下方连通探测按钮重试"}
                      </div>
                    )}
                  </div>

                  {/* 底部 CRUD 操作工具栏 */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: 10,
                      borderTop: "1px solid #f1f5f9",
                      marginTop: 4,
                    }}
                  >
                    <Button
                      size="small"
                      icon={<ThunderboltFilled />}
                      loading={testingId === repo.id}
                      onClick={() => handleTestAndSync(repo.id || "")}
                      style={{
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#4f46e5",
                        background: "#eef2ff",
                        borderColor: "#c7d2fe",
                        fontWeight: 600,
                        height: 30,
                      }}
                    >
                      连通探测
                    </Button>

                    <Space size={6}>
                      <Button
                        size="small"
                        type="default"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEdit(repo)}
                        style={{
                          color: "#0f172a",
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          height: 30,
                          borderColor: "#cbd5e1",
                        }}
                      >
                        修改配置
                      </Button>
                      <Popconfirm
                        title="确定要解绑并移除此代码仓库吗？"
                        description="移除后，智能体将停止对该代码库进行日常巡检守护。"
                        onConfirm={() => handleDeleteRepo(repo.id || "")}
                        okText="确认解绑"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          style={{ fontSize: 12, height: 30 }}
                        >
                          解绑移除
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>
    </div>
  );
};

export default Step1Repositories;
