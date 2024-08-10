import { serve } from 'bun';
import { RouterOSAPI } from 'node-routeros';

const path = '/config/config.json';
const cfgfile = Bun.file(path);
let cfg = await cfgfile.json();

let api = new RouterOSAPI({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
});

let maincidr = cfg.maincidr;
let proxycidr = cfg.proxycidr;
let haslogin = cfg.login;
type Device = {
    id: string;
    address: string;
    mac: string;
    status: string;
    host: string;
    comment: string;
};
let list: Device[] = [];

if (haslogin) {
    if (!(await connectAPI())) {
        haslogin = false;
    }
}

const server = serve({
    port: cfg.port,
    async fetch(request, server) {
        const url = new URL(request.url);
        if (url.pathname === '/') {
            let file = haslogin
                ? Bun.file('./index.html')
                : Bun.file('./login.html');
            return new Response(file);
        }

        if (url.pathname === '/core/login/') {
            let data = await request.json();
            if (data.user === '' || data.password === '' || data.host === '') {
                return new Response('参数缺失', { status: 400 });
            }
            api = new RouterOSAPI({
                host: data.host,
                user: data.user,
                password: data.password,
            });
            if (await connectAPI()) {
                writeConfig(
                    data.host,
                    data.user,
                    data.password,
                    data.main,
                    data.proxy
                );
                maincidr = data.main;
                proxycidr = data.proxy;
                console.log('配置文件已更新');
                return new Response('登入成功');
            } else {
                return new Response('ROS登入失败', { status: 400 });
            }
        }

        if (url.pathname === '/core/get/') {
            if (!haslogin)
                return new Response('ROS配置未设置', { status: 401 });
            const sockaddr = server.requestIP(request);
            let ipaddr = sockaddr === null ? '' : sockaddr.address;
            console.log(sockaddr);
            return new Response(JSON.stringify(await getDHCPList(ipaddr)));
        }

        if (url.pathname === '/core/switch/') {
            if (!haslogin)
                return new Response('ROS配置未设置', { status: 401 });
            let data = await request.json();
            let id = data.id;
            let mac = data.mac;
            let group = data.group;
            if (id === '' && mac === '') {
                return new Response('参数缺失', { status: 401 });
            }
            let isExists: boolean = false;
            let addr = '';
            for (let i in list) {
                if (list[i].id === id || list[i].mac === mac) {
                    id = list[i].id;
                    addr = list[i].address;
                    isExists = true;
                }
            }
            if (!isExists) {
                return new Response('设备不存在', { status: 401 });
            }
            if (group !== 'main' && group !== 'proxy') {
                return new Response('group错误', { status: 401 });
            }
            if (maincidr === '' || proxycidr === '') {
                return new Response('配置文件错误', { status: 401 });
            }
            if (await switchNetgate(id, addr, group)) {
                return new Response('切换成功');
            } else {
                return new Response('切换失败', { status: 401 });
            }
        }

        if (url.pathname === '/core/logout/') {
            cleanConfig();
            return new Response('已登出');
        }

        return new Response('Page not found', { status: 404 });
    },
});
console.log(`前端已开启: http://localhost:${server.port} ...`);

async function connectAPI() {
    try {
        await api.connect();
        console.log('API登入成功');
        return true;
    } catch (err) {
        console.log(err);
        console.log('API登入失败');
        return false;
    }
}

async function getDHCPList(addr: string | null) {
    const result = await api.write('/ip/dhcp-server/lease/print');
    list = [];
    for (let eq in result) {
        let format = {
            id: result[eq]['.id'],
            address: result[eq]['address'],
            mac: result[eq]['mac-address'],
            status: result[eq]['status'],
            host: result[eq]['host-name'],
            comment: result[eq]['comment'],
        };
        if (addr !== null || addr !== undefined || addr !== '') {
            if (addr === format.address) {
                list.unshift(format);
            } else {
                list.push(format);
            }
            continue;
        }
        list.push(format);
    }
    return list;
}

async function switchNetgate(id: string, addr: string, group: string) {
    try {
        let mask = Number.parseInt(maincidr.split('/')[1]);
        let targetcidr = (group === 'proxy' ? proxycidr : maincidr)
            .split('/')[0]
            .split('.');
        let address = addr.split('.');
        let num = 2;
        if (mask == 16) {
            num = 1;
        } else if (mask == 8) {
            num = 0;
        }
        for (let i = 0; i <= num; i++) {
            address[i] = targetcidr[i];
        }
        console.log('原IP' + addr + '切换至' + address.join('.'));

        const result = await api.write('/ip/dhcp-server/lease/set', [
            '=.id=' + id,
            '=address=' + address.join('.'),
        ]);
        return true;
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function writeConfig(
    host: string,
    user: string,
    password: string,
    mcidr: string,
    pcidr: string
) {
    cfg.login = true;
    cfg.host = host;
    cfg.user = user;
    cfg.password = password;
    cfg.maincidr = mcidr;
    cfg.proxycidr = pcidr;

    haslogin = true;
    await Bun.write(path, JSON.stringify(cfg));
}

async function cleanConfig() {
    haslogin = false;
    cfg.login = false;
    cfg.host = '';
    cfg.user = '';
    cfg.password = '';
    cfg.maincidr = '';
    cfg.proxycidr = '';
    await Bun.write(path, JSON.stringify(cfg));
}
