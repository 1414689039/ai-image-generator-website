import { useState } from 'react'
import { X } from 'lucide-react'
import apiClient from '../api/client'

interface RechargeModalProps {
  onClose: () => void
}

const AMOUNTS = [
  { value: 10, label: '10元 (100积分)' },
  { value: 30, label: '30元 (300积分)' },
  { value: 50, label: '50元 (500积分)' },
  { value: 100, label: '100元 (1000积分)' },
]

export default function RechargeModal({ onClose }: RechargeModalProps) {
  const [amount, setAmount] = useState(10)
  const [customAmount, setCustomAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wxpay'>('alipay')
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    try {
      setLoading(true)
      const finalAmount = customAmount ? parseFloat(customAmount) : amount
      
      if (isNaN(finalAmount) || finalAmount <= 0) {
        alert('请输入有效的金额')
        return
      }

      const response = await apiClient.post('/payment/create-order', {
        amount: finalAmount,
        paymentMethod
      })

      const { paymentUrl } = response.data
      
      if (paymentUrl) {
        // 跳转到支付页面
        window.location.href = paymentUrl
      } else {
        alert('创建订单失败：未获取到支付链接')
      }
    } catch (error: any) {
      console.error('Recharge error:', error)
      alert(error.response?.data?.error || '创建订单失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-6">积分充值</h2>

        <div className="space-y-6">
          {/* 金额选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              充值金额
            </label>
            <div className="grid grid-cols-2 gap-3">
              {AMOUNTS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setAmount(opt.value)
                    setCustomAmount('')
                  }}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    amount === opt.value && !customAmount
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-medium">{opt.value}元</div>
                  <div className="text-xs text-gray-500">{opt.value * 10} 积分</div>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">¥</span>
                </div>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value)
                    setAmount(0)
                  }}
                  placeholder="自定义金额"
                  className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 border"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 sm:text-sm">CNY</span>
                </div>
              </div>
            </div>
          </div>

          {/* 支付方式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              支付方式
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('alipay')}
                className={`flex items-center justify-center p-3 border rounded-lg ${
                  paymentMethod === 'alipay'
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-200'
                }`}
              >
                <span className="font-medium text-blue-600">支付宝</span>
              </button>
              <button
                onClick={() => setPaymentMethod('wxpay')}
                className={`flex items-center justify-center p-3 border rounded-lg ${
                  paymentMethod === 'wxpay'
                    ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                    : 'border-gray-200'
                }`}
              >
                <span className="font-medium text-green-600">微信支付</span>
              </button>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '处理中...' : `立即支付 ${(customAmount ? parseFloat(customAmount) : amount) || 0} 元`}
          </button>
        </div>
      </div>
    </div>
  )
}
