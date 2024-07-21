import { serve } from "bun";
import { RouterOSAPI } from 'node-routeros';
import cfg from "./config.json";

let api = new RouterOSAPI({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password
});
let haslogin = cfg.login;
const maincidr = cfg.maincidr;
const proxycidr = cfg.proxycidr;

if (haslogin) {
    if (!await connectAPI()) {
        haslogin = false;
    }
}

const server = serve({
    port: 3000, async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/") {
            let file = haslogin ? Bun.file("./index.html") : Bun.file("./login.html");
            return new Response(file);
        }

        if (url.pathname === "/core/login/") {
            let data = await request.json();
            if (data.user === "" || data.password === "" || data.host === "") {
                return new Response("参数错误", { status: 400 });
            }
            api = new RouterOSAPI({
                host: data.host,
                user: data.user,
                password: data.password
            });
            if (await connectAPI()) {
                writeConfig(data.host, data.user, data.password, data.main, data.proxy);
                console.log("配置文件已更新");
                return new Response("登入成功");
            } else {
                return new Response("ROS登入失败", { status: 400 });
            }
        }

        if (url.pathname === "/core/get/") {
            if (!haslogin) return new Response("ROS配置未设置", { status: 401 });
            return new Response(JSON.stringify(await getDHCPList()));
        }

        if (url.pathname === "/core/switch/") {
            if (!haslogin) return new Response("ROS配置未设置", { status: 401 });
            let data = await request.json();
            let id = data.id;
            let mac = data.mac;
            let group = data.group;
            if ((id === "" && mac === "") || group === "") {
                return new Response("400 Bad Request", { status: 400 });
            }
            switchNetgate('*458',group);
        }

        if (url.pathname === "/core/logout/") {
            cleanConfig();
            return new Response("已登出");
        }

        return new Response("Page not found", { status: 404 });
    }
});
console.log(`Listening on http://localhost:${server.port} ...`);

async function connectAPI() {
    try {
        await api.connect();
        console.log("API登入成功");
        return true;
    } catch (err) {
        console.log(err);
        console.log("API登入失败");
        return false;
    }
}

async function getDHCPList() {
    const result = await api.write('/ip/dhcp-server/lease/print');
    let list = [];
    for (let eq in result) {
        list.push({
            'id': result[eq]['.id'],
            'address': result[eq]['address'],
            'mac-address': result[eq]['mac-address'],
            'status': result[eq]['status'],
            'host-name': result[eq]['host-name'],
            'comment': result[eq]['comment'],
        });
    }
    console.log(list);
    return list;
}

async function switchNetgate(id:string,group:string) {
    const result = await api.write('/ip/dhcp-server/lease/set',['=.id='+id,'=address='+(group==='proxy'?'10.225.1.100':'10.225.0.100')]);
}

async function writeConfig(host: string, user: string, password: string, mcidr: string, pcidr: string) {
    cfg.login = true;
    cfg.host = host;
    cfg.user = user;
    cfg.password = password;
    cfg.maincidr = mcidr;
    cfg.proxycidr = pcidr;

    haslogin = true;
    await Bun.write("./config.json", JSON.stringify(cfg));
}

async function cleanConfig() {
    cfg.login = false;
    haslogin = false;
    await Bun.write("./config.json", JSON.stringify(cfg));
}