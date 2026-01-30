const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:8787/api';

// 模拟用户数据
const testUser = {
    username: `login_test_${Date.now()}`,
    email: `login_${Date.now()}@test.com`,
    password: 'password123'
};

async function runTests() {
    console.log('开始执行登录功能测试...\n');
    const report = [];

    // 1. 注册用户 (前置条件)
    console.log('[Step 1] 注册新用户...');
    try {
        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        if (regRes.status !== 201) {
            throw new Error(`注册失败: ${regRes.status} ${await regRes.text()}`);
        }
        console.log('  -> 注册成功 (OK)\n');
    } catch (error) {
        console.error(`  -> 前置步骤失败: ${error.message}`);
        // 如果连接失败，直接退出
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
            console.error('\n!!! 错误: 无法连接到后端服务。请确保已运行 "npm run dev:worker" !!!');
            process.exit(1);
        }
        process.exit(1);
    }

    // 2. 测试正常登录
    await runSingleTest({
        name: 'Case 1: 正常登录 (Valid Login)',
        url: `${BASE_URL}/auth/login`,
        method: 'POST',
        payload: {
            username: testUser.username,
            password: testUser.password
        },
        expectedStatus: 200,
        verify: (data) => {
            if (!data.token) return '缺少 Token';
            if (!data.user) return '缺少用户信息';
            if (data.user.username !== testUser.username) return '用户名不匹配';
            testUser.token = data.token; // 保存 Token 用于后续测试
            return true;
        }
    }, report);

    // 3. 测试错误密码
    await runSingleTest({
        name: 'Case 2: 错误密码登录 (Invalid Password)',
        url: `${BASE_URL}/auth/login`,
        method: 'POST',
        payload: {
            username: testUser.username,
            password: 'wrongpassword'
        },
        expectedStatus: 401
    }, report);

    // 4. 测试受保护资源 (模拟进入主页)
    if (testUser.token) {
        await runSingleTest({
            name: 'Case 3: 访问受保护资源/主页 (Access Protected Route)',
            url: `${BASE_URL}/user/me`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${testUser.token}`
            },
            expectedStatus: 200,
            verify: (data) => {
                if (data.username !== testUser.username) return '获取的用户信息不匹配';
                return true;
            }
        }, report);
    } else {
        console.log('[Skipping] Case 3: 由于登录失败，跳过受保护资源测试');
        report.push({ name: 'Case 3', status: 'SKIPPED' });
    }

    // 输出总结
    console.log('\n================ 测试总结 ================');
    const successCount = report.filter(r => r.status === 'PASS').length;
    console.log(`总计: ${report.length}, 成功: ${successCount}, 失败: ${report.length - successCount}`);
    
    fs.writeFileSync('test-login-report.json', JSON.stringify(report, null, 2));
}

async function runSingleTest(test, report) {
    console.log(`[Testing] ${test.name}`);
    const startTime = Date.now();
    
    try {
        const options = {
            method: test.method,
            headers: {
                'Content-Type': 'application/json',
                ...test.headers
            }
        };
        
        if (test.payload) {
            options.body = JSON.stringify(test.payload);
        }

        const response = await fetch(test.url, options);
        const data = await response.json();
        const duration = Date.now() - startTime;
        
        let pass = response.status === test.expectedStatus;
        let errorMsg = null;

        if (pass && test.verify) {
            const verifyResult = test.verify(data);
            if (verifyResult !== true) {
                pass = false;
                errorMsg = verifyResult;
            }
        }

        if (!pass) {
            console.log(`  -> Response Body: ${JSON.stringify(data)}`);
        }

        console.log(`  -> Status: ${response.status} (${pass ? 'PASS' : 'FAIL'})`);
        if (errorMsg) console.log(`  -> Verify Error: ${errorMsg}`);
        console.log(`  -> Duration: ${duration}ms\n`);
        
        report.push({
            name: test.name,
            status: pass ? 'PASS' : 'FAIL',
            expected: test.expectedStatus,
            actual: response.status,
            error: errorMsg,
            response: data
        });

    } catch (error) {
        console.error(`  -> Error: ${error.message}\n`);
        report.push({
            name: test.name,
            status: 'ERROR',
            error: error.message
        });
    }
}

runTests();
