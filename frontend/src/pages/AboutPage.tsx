import React, { useEffect } from 'react';
import { motion } from 'motion/react';

export default function AboutPage() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="w-full text-slate-900 font-sans selection:bg-violet-100 animate-rise">
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-20 text-center space-y-16">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-16"
                >
                    <div className="w-12 h-px bg-gray-200 mx-auto mb-16" />

                    <div className="max-w-2xl mx-auto space-y-12 mb-24 text-lg md:text-xl text-gray-700 leading-relaxed font-medium">

                        <div className="space-y-6">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-6">프레임 레이더란?</h2>
                            <p className="text-[16px] md:text-lg">
                                프레임 레이더는 뉴스 기사 속 언어적 프레이밍 패턴을 분석하여,<br className="hidden md:block" />
                                독자가 보다 비판적으로 읽을 수 있도록 돕는 도구입니다.
                            </p>
                        </div>

                        <div className="w-8 h-px bg-gray-200 mx-auto my-12" />

                        <div className="space-y-6">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-6">왜 만들었나요?</h2>
                            <p className="text-[16px] md:text-lg">
                                우리는 매일 수많은 기사를 읽습니다.<br />
                                그런데 같은 사건도 어떤 기사는 화가 나고,<br />
                                어떤 기사는 담담하게 읽힙니다.
                            </p>
                            <p className="text-violet-600 font-bold bg-violet-50 inline-block px-3 py-1.5 rounded text-[16px] md:text-lg mt-2">
                                차이는 사실이 아니라 표현에 있습니다.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <p className="text-[16px] md:text-lg">
                                디지털 플랫폼에서 분노와 공포는<br className="hidden md:block" />
                                클릭과 체류 시간을 늘리는 효율적인 연료입니다.<br className="hidden md:block" />
                                미디어와 알고리즘이 이 구조에 최적화될수록,<br className="hidden md:block" />
                                감정 자극형 표현은 의도와 무관하게 반복 생산됩니다.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <p className="text-[16px] md:text-lg font-bold">
                                프레임 레이더는 그 구조를 인식하는 것이<br />
                                비판적 읽기의 첫 번째 단계라고 생각합니다.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-16 max-w-[22rem] md:max-w-md mx-auto text-center text-[15px] md:text-[16px]">
                        <div className="space-y-4">
                            <p className="text-xs md:text-sm tracking-[0.15em] uppercase text-gray-400 font-bold text-center">Methodology</p>
                            <p className="text-gray-600 leading-relaxed text-center break-keep">
                                프레임 레이더는 해외 프로젝트인 <a href="https://ragecheck.com" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-500 font-bold underline underline-offset-4 decoration-violet-200 hover:decoration-violet-400 transition-colors">RageCheck</a>의 방법론을 참고해 시작되었습니다. 해당 서비스의 5대 신호(5 Signals) 분석 구조와 밀도 기반 점수 산정 방식을 기반으로 설계되었으며, 관심경제 관점을 결합해 확장하였습니다.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-xs md:text-sm tracking-[0.15em] uppercase text-gray-400 font-bold text-center">About Score</p>
                            <div className="text-gray-600 text-center space-y-2 break-keep">
                                <p className="leading-relaxed">
                                    해당 텍스트 안에서 강한 프레이밍 신호가 작동하고 있다는 언어적 지표입니다. 점수는 기사의 진실 여부가 아니라, 표현 방식의 강도를 나타냅니다.
                                </p>
                                <p className="text-violet-600 font-bold mt-4">높은 점수는 나쁜 기사를 의미하지 않습니다.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-xs md:text-sm tracking-[0.15em] uppercase text-gray-400 font-bold text-center">What we don't do</p>
                            <div className="text-gray-600 text-center space-y-4 break-keep">
                                <p className="leading-relaxed">
                                    사실 여부를 검증하지 않습니다.<br />
                                    옳고 그름을 판정하지 않습니다.<br />
                                    특정 정치 성향이나 진영을 평가하지 않습니다.
                                </p>
                                <p className="text-violet-600 font-bold mt-4">
                                    이 도구는 판단을 대신하지 않습니다.<br />
                                    스스로 판단할 수 있도록 돕습니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Contact */}
                    <div className="pt-16 pb-8 border-t border-slate-200 text-center">
                        <p className="text-slate-600 font-medium">
                            궁금한 점이 있으시면 <a href="https://forms.gle/C6J3Tx28tGSGdfZ2A" target="_blank" rel="noopener noreferrer" className="text-violet-600 font-bold hover:text-violet-500 underline underline-offset-4 decoration-violet-200 hover:decoration-violet-400 transition-colors">문의하기</a>를 이용해주세요.
                        </p>
                    </div>

                </motion.div>
            </div>
        </div>
    );
}
