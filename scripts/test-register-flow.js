const fs = require('fs');

const API_URL = 'http://127.0.0.1:8787/api/auth/register';

// 测试用例
const testCases = [
    {
        name: 'Case 1: 正常注册 (Valid User)',
        payload: {
            username: `user_${Date.now()}`,
            email: `user_${Date.now()}@example.com`,
            password: 'password123'
        },
        expectedStatus: 201
    },
    {
        name: 'Case 2: 密码过短 (Short Password)',
        payload: {
            username: `user_${Date.now()}_short`,
            email: `short_${Date.now()}@example.com`,
            password: '123'
        },
        expectedStatus: 400
    },
    {
        name: 'Case 3: 缺少字段 - 无密码 (Missing Password)',
        payload: {
            username: `user_${Date.now()}_nopass`,
            email: `nopass_${Date.now()}@example.com`
        },
        expectedStatus: 400
    },
    {
        name: 'Case 4: 缺少字段 - 无邮箱 (Missing Email)',
        payload: {
            username: `user_${Date.now()}_noemail`,
            password: 'password123'
        },
        expectedStatus: 400
    }
];

// 重复注册测试需要依赖 Case 1 的成功结果
const duplicateTest = {
    name: 'Case 5: 重复用户名/邮箱 (Duplicate)',
    // payload 将在运行时从 Case 1 复制
    expectedStatus: 400
};

async function runTests() {
    console.log('开始执行注册功能测试...\n');
    const report = [];
    
    // 运行基础测试用例
    for (const test of testCases) {
        await runSingleTest(test, report);
    }

    // 运行重复注册测试
    if (testCases[0].successPayload) {
        duplicateTest.payload = testCases[0].successPayload;
        await runSingleTest(duplicateTest, report);
    } else {
        console.log('跳过重复注册测试（因为正常注册测试失败）');
        report.push({
            name: duplicateTest.name,
            status: 'SKIPPED',
            details: '依赖的正常注册测试失败'
        });
    }

    // 输出总结
    console.log('\n================ 测试总结 ================');
    const successCount = report.filter(r => r.status === 'PASS').length;
    console.log(`总计: ${report.length}, 成功: ${successCount}, 失败: ${report.length - successCount}`);
    
    fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
    console.log('测试报告已保存至 test-report.json');
}

async function runSingleTest(test, report) {
    console.log(`[Testing] ${test.name}`);
    const startTime = Date.now();
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(test.payload)
        });

        const data = await response.json();
        const duration = Date.now() - startTime;
        
        const result = {
            name: test.name,
            payload: test.payload,
            expectedStatus: test.expectedStatus,
            actualStatus: response.status,
            response: data,
            duration: `${duration}ms`,
            status: response.status === test.expectedStatus ? 'PASS' : 'FAIL'
        };

        if (response.status === 201 && test.name.includes('正常注册')) {
            test.successPayload = test.payload;
        }

        console.log(`  -> Status: ${response.status} (${result.status})`);
        console.log(`  -> Response: ${JSON.stringify(data)}`);
        console.log(`  -> Duration: ${duration}ms\n`);
        
        report.push(result);

    } catch (error) {
        console.error(`  -> Error: ${error.message}\n`);
        report.push({
            name: test.name,
            payload: test.payload,
            expectedStatus: test.expectedStatus,
            error: error.message,
            status: 'ERROR'
        });
    }
}

runTests();
